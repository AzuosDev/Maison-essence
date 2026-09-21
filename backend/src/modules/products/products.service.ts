import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import { Types } from 'mongoose';
import type { Paginated } from '../../common/pagination.js';
import { paginate, skipFor } from '../../common/pagination.js';
import { Order, Product } from '../../schemas.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { ListProductsDto } from './dto/list-products.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import type { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import { searchFilter, usesTextIndex } from './product-search.js';
import { toProductView } from './product.view.js';
import type { ProductView } from './product.view.js';
import { DEFAULT_PAGE_SIZE, PRODUCT_NOT_FOUND_MESSAGE } from './products.constants.js';
import type { ProductDocument, ProductVariant } from './schemas/product.schema.js';
import { generateSku } from './sku.js';
import { planVariants } from './variants.diff.js';
import type { VariantInput, VariantPlan } from './variants.diff.js';

export const SLUG_TAKEN_MESSAGE = 'Ja existe um produto nesse endereco. Escolha outro.';

/** Variante pronta para gravar: campos crus, do jeito que o Mongoose aceita. */
type VariantData = Record<string, unknown>;

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
  ) {}

  /**
   * Listagem do painel: busca, filtro e pagina.
   *
   * A contagem vai em paralelo com a pagina porque sao duas idas ao banco
   * independentes, e na funcao serverless o que pesa e o tempo somado.
   */
  async list(query: ListProductsDto): Promise<Paginated<ProductView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const term = query.q ?? '';
    const filter = this.filterFor(query, term);
    const finder = this.products.find(filter);

    if (term.length > 0 && usesTextIndex(term)) {
      // Relevancia primeiro: quem procurou "asad" quer o Asad no topo, e nao
      // o mais recente que cite a palavra.
      finder
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 });
    } else {
      finder.sort({ createdAt: -1 });
    }

    const [found, totalItems] = await Promise.all([
      finder.skip(skipFor(page, limit)).limit(limit).exec(),
      this.products.countDocuments(filter).exec(),
    ]);

    return paginate(found.map(toProductView), totalItems, page, limit);
  }

  async findOne(id: string): Promise<ProductView> {
    return toProductView(await this.findById(id));
  }

  async create(dto: CreateProductDto): Promise<ProductView> {
    if (dto.slug !== undefined) {
      await this.assertSlugIsFree(dto.slug);
    }

    const product = new this.products({
      name: dto.name,
      // Vazio de proposito quando nao veio: o hook do schema gera o endereco
      // a partir do nome, desviando para `nome-2` se ja estiver ocupado.
      slug: dto.slug ?? '',
      description: dto.description ?? '',
      brand: dto.brand ?? '',
      categoryIds: toObjectIds(dto.categoryIds),
      images: dto.images ?? [],
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
      isReadyToShip: dto.isReadyToShip ?? false,
      tags: dto.tags ?? [],
    });

    product.set({ variants: this.buildVariants(dto.name, dto.variants ?? []) });

    return toProductView(await this.save(product));
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductView> {
    const product = await this.findById(id);

    if (dto.variants !== undefined) {
      product.set({ variants: await this.diffVariants(product, dto.variants) });
    }

    if (dto.name !== undefined) {
      product.name = dto.name;
    }

    if (dto.description !== undefined) {
      product.description = dto.description;
    }

    if (dto.brand !== undefined) {
      product.brand = dto.brand;
    }

    if (dto.categoryIds !== undefined) {
      product.set({ categoryIds: toObjectIds(dto.categoryIds) });
    }

    if (dto.images !== undefined) {
      // A posicao no array e a ordenacao das fotos: a primeira e a capa.
      product.set({ images: dto.images });
    }

    if (dto.isActive !== undefined) {
      product.isActive = dto.isActive;
    }

    if (dto.isFeatured !== undefined) {
      product.isFeatured = dto.isFeatured;
    }

    if (dto.isReadyToShip !== undefined) {
      product.isReadyToShip = dto.isReadyToShip;
    }

    if (dto.tags !== undefined) {
      product.set({ tags: dto.tags });
    }

    return toProductView(await this.save(product));
  }

  /** O interruptor da listagem: tira da vitrine sem abrir o cadastro. */
  async setStatus(id: string, dto: UpdateProductStatusDto): Promise<ProductView> {
    const product = await this.findById(id);

    if (product.isActive === dto.isActive) {
      return toProductView(product);
    }

    product.isActive = dto.isActive;

    return toProductView(await this.save(product));
  }

  /**
   * Exclui, desde que o produto nunca tenha sido vendido.
   *
   * O pedido guarda nome, preco e imagem copiados, entao apagar o produto nao
   * estraga a leitura do historico — mas estraga o cancelamento, que devolve
   * o estoque procurando a variante pelo `items.variantId`. Produto ja
   * vendido se desativa; some da loja e o pedido antigo continua inteiro.
   */
  async remove(id: string): Promise<void> {
    const product = await this.findById(id);
    const orderCount = await this.countOrdersWith(product);

    if (orderCount > 0) {
      throw new ConflictException({
        message: ordersMessage(orderCount),
        details: { orderCount, canDeactivate: true },
      });
    }

    await product.deleteOne();
  }

  private filterFor(query: ListProductsDto, term: string): QueryFilter<Product> {
    const filter: QueryFilter<Product> = {};

    if (query.categoryId !== undefined) {
      filter.categoryIds = new Types.ObjectId(query.categoryId);
    }

    if (query.status === 'active' || query.status === 'inactive') {
      filter.isActive = query.status === 'active';
    }

    return term.length > 0 ? { ...filter, ...searchFilter(term) } : filter;
  }

  /** Monta as variantes de um produto novo, gerando o SKU que faltar. */
  private buildVariants(productName: string, incoming: readonly VariantInput[]): VariantData[] {
    const taken = new Set<string>();

    return incoming.map((data) => variantData(data, resolveSku(productName, data, taken)));
  }

  /**
   * Reconcilia o array recebido com o que esta gravado.
   *
   * Devolve a lista completa para `set`, com os `_id` das variantes que
   * continuam: e o `_id` que os pedidos guardam, e trocar de identidade seria
   * o mesmo que apagar a variante e criar outra igual.
   */
  private async diffVariants(
    product: ProductDocument,
    incoming: readonly VariantInput[],
  ): Promise<VariantData[]> {
    const existing = new Map(product.variants.map((variant) => [variant.id, variant]));
    const { plans, unknownIds } = planVariants(
      incoming,
      [...existing.keys()],
      await this.soldVariantIds(product),
    );

    if (unknownIds.length > 0) {
      throw new UnprocessableEntityException(
        `Variante que nao e deste produto: ${unknownIds.join(', ')}.`,
      );
    }

    // Os SKUs que sobrevivem, antes de gerar qualquer um: a variante
    // aposentada fica no fim da lista, mas o SKU dela continua ocupado e o
    // gerado para uma variante nova nao pode esbarrar nele.
    const taken = new Set<string>();

    for (const plan of plans) {
      if (plan.action === 'update' || plan.action === 'retire') {
        taken.add(skuOf(plan, existing));
      }
    }

    const next: VariantData[] = [];

    for (const plan of plans) {
      if (plan.action === 'drop') {
        continue;
      }

      if (plan.action === 'add') {
        next.push(variantData(plan.data, resolveSku(product.name, plan.data, taken)));

        continue;
      }

      const variant = existing.get(plan.id);

      if (!variant) {
        continue;
      }

      next.push(
        plan.action === 'retire'
          ? { ...variantDataOf(variant), _id: plan.id, isActive: false }
          : { ...merge(variant, plan.data), _id: plan.id, sku: skuOf(plan, existing) },
      );
    }

    return next;
  }

  /**
   * Quais variantes deste produto ja aparecem em algum pedido.
   *
   * O `distinct` devolve os `variantId` dos pedidos que casaram — inclusive
   * de outros produtos comprados junto. Nao incomoda: so sao consultadas as
   * chaves deste produto.
   */
  private async soldVariantIds(product: ProductDocument): Promise<Set<string>> {
    const ids = variantObjectIds(product);

    if (ids.length === 0) {
      return new Set<string>();
    }

    const sold = await this.orders
      .distinct('items.variantId', { 'items.variantId': { $in: ids } })
      .exec();

    return new Set(sold.map((id) => String(id)));
  }

  private async countOrdersWith(product: ProductDocument): Promise<number> {
    const ids = variantObjectIds(product);

    if (ids.length === 0) {
      return 0;
    }

    return this.orders.countDocuments({ 'items.variantId': { $in: ids } }).exec();
  }

  private async assertSlugIsFree(slug: string): Promise<void> {
    const existing = await this.products.findOne({ slug }).select('_id').exec();

    if (existing) {
      throw new ConflictException(SLUG_TAKEN_MESSAGE);
    }
  }

  /** Busca pelo id, tratando id malformado como "nao encontrado". */
  private async findById(id: string): Promise<ProductDocument> {
    const found = Types.ObjectId.isValid(id)
      ? await this.products.findById(new Types.ObjectId(id)).exec()
      : null;

    if (!found) {
      throw new NotFoundException(PRODUCT_NOT_FOUND_MESSAGE);
    }

    return found;
  }

  /** Salva traduzindo a colisao do indice unico de slug em 409. */
  private async save(product: ProductDocument): Promise<ProductDocument> {
    try {
      return await product.save();
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        throw new ConflictException(SLUG_TAKEN_MESSAGE);
      }

      throw error;
    }
  }
}

const DUPLICATE_KEY = 11000;

/**
 * O SKU com que uma variante que ja existe vai ficar: o que o PATCH mandou,
 * ou o que ela ja tinha. A aposentada nunca troca de SKU — ela nem veio na
 * lista recebida.
 */
function skuOf(
  plan: Extract<VariantPlan, { action: 'update' | 'retire' }>,
  existing: ReadonlyMap<string, ProductVariant>,
): string {
  const current = existing.get(plan.id)?.sku ?? '';
  const wanted = plan.action === 'update' ? plan.data.sku : undefined;

  return wanted && wanted.length > 0 ? wanted : current;
}

/** SKU informado vence; sem ele, um gerado do nome do produto e do label. */
function resolveSku(productName: string, data: VariantInput, taken: Set<string>): string {
  const sku =
    data.sku && data.sku.length > 0
      ? data.sku
      : generateSku(productName, data.label ?? '', taken);

  taken.add(sku);

  return sku;
}

/** Variante nova: o que o DTO trouxe, com o padrao de cada campo omitido. */
function variantData(data: VariantInput, sku: string): VariantData {
  return {
    sku,
    label: data.label ?? '',
    priceCents: data.priceCents,
    compareAtPriceCents: data.compareAtPriceCents ?? null,
    stock: data.stock ?? 0,
    image: data.image ?? '',
    isActive: data.isActive ?? true,
    allowBackorder: data.allowBackorder ?? false,
  };
}

/** Variante que ja existe, campo a campo. */
function variantDataOf(variant: ProductVariant): VariantData {
  return {
    sku: variant.sku,
    label: variant.label,
    priceCents: variant.priceCents,
    compareAtPriceCents: variant.compareAtPriceCents,
    stock: variant.stock,
    image: variant.image,
    isActive: variant.isActive,
    allowBackorder: variant.allowBackorder,
  };
}

/**
 * Sobrepoe na variante gravada so o que veio no PATCH.
 *
 * Campo omitido fica como esta, e nao volta ao padrao: o painel que manda so
 * o estoque novo nao pode, por isso, reativar uma variante desativada.
 */
function merge(variant: ProductVariant, data: VariantInput): VariantData {
  const current = variantDataOf(variant);

  return {
    ...current,
    ...(data.label === undefined ? {} : { label: data.label }),
    priceCents: data.priceCents,
    ...(data.compareAtPriceCents === undefined
      ? {}
      : { compareAtPriceCents: data.compareAtPriceCents }),
    ...(data.stock === undefined ? {} : { stock: data.stock }),
    ...(data.image === undefined ? {} : { image: data.image }),
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
    ...(data.allowBackorder === undefined ? {} : { allowBackorder: data.allowBackorder }),
  };
}

function variantObjectIds(product: ProductDocument): Types.ObjectId[] {
  return product.variants.map((variant) => new Types.ObjectId(variant.id));
}

function toObjectIds(ids: readonly string[] | undefined): Types.ObjectId[] {
  return (ids ?? []).map((id) => new Types.ObjectId(id));
}

function ordersMessage(count: number): string {
  const pedidos = count === 1 ? '1 pedido' : `${count} pedidos`;

  return `Este produto ja aparece em ${pedidos} e por isso nao pode ser excluido. Desative o produto para tira-lo da loja sem mexer no historico.`;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
