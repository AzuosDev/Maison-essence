import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import type { Paginated } from '../../common/pagination.js';
import { paginate, skipFor } from '../../common/pagination.js';
import { slugify } from '../../database/slug.js';
import { Category, Order, Product, QuantityDiscount, SOLD_ORDER_STATUSES } from '../../schemas.js';
import { CATEGORY_NOT_FOUND_MESSAGE } from '../categories/categories.constants.js';
import {
  catalogCollation,
  catalogFilter,
  catalogPipeline,
  effectiveSort,
  hasTextScore,
} from './catalog.query.js';
import type { CatalogFilterInput } from './catalog.query.js';
import type { ListPublicProductsDto } from './dto/list-public-products.dto.js';
import { toPublicCategories, toPublicProductView } from './public-product.view.js';
import type {
  LeanProduct,
  LeanProductFull,
  PublicProductDetailView,
  PublicProductView,
} from './public-product.view.js';
import {
  PRODUCT_NOT_FOUND_MESSAGE,
  PUBLIC_PAGE_SIZE,
  RELATED_LIMIT,
  SHELF_SIZE,
} from './products.constants.js';
import { discountLadder, entryTier } from './quantity-discount.js';
import type { QuantityDiscountRule, QuantityDiscountTier } from './quantity-discount.js';

/** O card não mostra a descrição, e ela e o maior campo do produto. */
const CARD_FIELDS = '-description';

/**
 * Quantas posições do ranking buscar para cada vaga da prateleira.
 *
 * O ranking sai dos pedidos, que continuam citando produto desativado ou
 * excluído da loja. Buscar com folga evita que a prateleira de mais vendidos
 * chegue pela metade a home por causa de dois produtos que saíram de linha.
 */
const RANKING_SLACK = 3;

interface SoldRow {
  _id: Types.ObjectId;
  sold: number;
}

/**
 * A loja aberta: tudo que a vitrine lê.
 *
 * Separado de `ProductsService` porque as duas leituras não se parecem. O
 * painel lista para editar — quer o inativo, o esgotado, o SKU. A vitrine
 * lista para vender, nunca grava nada, e por isso lê `lean`: sem hidratar
 * documento do Mongoose, que na função serverless custa tempo por resposta.
 */
@Injectable()
export class PublicCatalogService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(QuantityDiscount.name) private readonly discounts: Model<QuantityDiscount>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
  ) {}

  /**
   * A vitrine com busca, filtros e página.
   *
   * Os filtros viram um documento só, e a contagem roda em paralelo com a
   * página: são duas idas ao Atlas independentes, e o que pesa na função
   * serverless e o tempo somado.
   */
  async list(query: ListPublicProductsDto): Promise<Paginated<PublicProductView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? PUBLIC_PAGE_SIZE;
    const term = query.q ?? '';
    const filter = catalogFilter({
      categoryIds:
        query.category === undefined ? undefined : await this.categoryBranch(query.category),
      q: term,
      brand: query.brand,
      minPriceCents: query.minPrice,
      maxPriceCents: query.maxPrice,
      inStock: query.inStock,
      readyToShip: query.readyToShip,
      featured: query.featured,
    });
    const hasText = hasTextScore(term);
    const sort = effectiveSort(query.sort, hasText);
    const aggregation = this.products.aggregate<LeanProduct>(
      catalogPipeline(filter, sort, hasText, skipFor(page, limit), limit),
    );
    const collation = catalogCollation(sort);

    if (collation) {
      aggregation.collation(collation);
    }

    const [found, totalItems] = await Promise.all([
      aggregation.exec(),
      this.products.countDocuments(filter).exec(),
    ]);

    return paginate(await this.toCards(found), totalItems, page, limit);
  }

  /** Prateleira de destaques da home. */
  featured(limit = SHELF_SIZE): Promise<PublicProductView[]> {
    return this.shelf({ featured: true }, limit);
  }

  /** Prateleira de pronta entrega: o que sai de Sobral sem esperar encomenda. */
  readyToShip(limit = SHELF_SIZE): Promise<PublicProductView[]> {
    return this.shelf({ readyToShip: true }, limit);
  }

  /**
   * Mais vendidos, por quantidade somada nos pedidos que viraram venda.
   *
   * A soma e de unidades e não de pedidos: dez frascos em uma compra só pesam
   * dez. O ranking sai dos pedidos e a vitrine sai do catálogo, então produto
   * desativado desaparece da prateleira sem sumir do histórico.
   */
  async bestSellers(limit = SHELF_SIZE): Promise<PublicProductView[]> {
    const ranking = await this.orders
      .aggregate<SoldRow>([
        { $match: { status: { $in: [...SOLD_ORDER_STATUSES] } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', sold: { $sum: '$items.quantity' } } },
        { $sort: { sold: -1, _id: -1 } },
        { $limit: limit * RANKING_SLACK },
      ])
      .exec();

    if (ranking.length === 0) {
      return [];
    }

    const found = await this.products
      .find({
        _id: { $in: ranking.map((row) => row._id) },
        isActive: true,
        variants: { $elemMatch: { isActive: true } },
      })
      .select(CARD_FIELDS)
      .lean<LeanProduct[]>()
      .exec();
    const byId = new Map(found.map((product) => [product._id.toHexString(), product]));
    // A ordem e a do ranking, não a do `$in`: o Mongo devolve na ordem que
    // achar melhor, e aqui a ordem e o conteúdo da prateleira.
    const ordered = ranking
      .map((row) => byId.get(row._id.toHexString()))
      .filter((product): product is LeanProduct => product !== undefined)
      .slice(0, limit);

    return this.toCards(ordered);
  }

  /**
   * A página do produto: ele, as categorias dele e até oito relacionados.
   *
   * Produto inativo e produto que ficou sem nenhuma variante a venda dao 404
   * iguais. O segundo caso não e detalhe: sem variante ativa não há preço nem
   * botão de comprar, e a página só serviria para frustrar quem clicou.
   */
  async findBySlug(slug: string): Promise<PublicProductDetailView> {
    const product = await this.products
      .findOne({
        slug: slugify(slug),
        isActive: true,
        variants: { $elemMatch: { isActive: true } },
      })
      .lean<LeanProductFull | null>()
      .exec();

    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND_MESSAGE);
    }

    const [categories, related] = await Promise.all([
      this.categories
        .find({ _id: { $in: product.categoryIds }, isActive: true })
        .sort({ order: 1, name: 1 })
        .exec(),
      this.relatedTo(product),
    ]);
    const rules = await this.rulesFor([product, ...related]);
    const ladder = this.ladderOf(rules, product);

    return {
      ...toPublicProductView(product, entryTier(ladder)),
      description: product.description,
      categories: toPublicCategories(categories),
      quantityDiscounts: ladder,
      related: related.map((other) => toPublicProductView(other, this.entryOf(rules, other))),
    };
  }

  private async shelf(input: CatalogFilterInput, limit: number): Promise<PublicProductView[]> {
    const found = await this.products
      .aggregate<LeanProduct>(catalogPipeline(catalogFilter(input), 'newest', false, 0, limit))
      .exec();

    return this.toCards(found);
  }

  /**
   * Os produtos que a vitrine mostra ao lado deste.
   *
   * Destaque primeiro e depois o mais novo: quando dez produtos dividem a
   * categoria, e a dona quem decide quais valem a vaga, marcando-os como
   * destaque no painel.
   */
  private relatedTo(product: LeanProduct): Promise<LeanProduct[]> {
    if (product.categoryIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.products
      .find({
        _id: { $ne: product._id },
        categoryIds: { $in: product.categoryIds },
        isActive: true,
        variants: { $elemMatch: { isActive: true } },
      })
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(RELATED_LIMIT)
      .select(CARD_FIELDS)
      .lean<LeanProduct[]>()
      .exec();
  }

  private async toCards(products: readonly LeanProduct[]): Promise<PublicProductView[]> {
    const rules = await this.rulesFor(products);

    return products.map((product) => toPublicProductView(product, this.entryOf(rules, product)));
  }

  private entryOf(
    rules: readonly QuantityDiscountRule[],
    product: LeanProduct,
  ): QuantityDiscountTier | null {
    return entryTier(this.ladderOf(rules, product));
  }

  private ladderOf(
    rules: readonly QuantityDiscountRule[],
    product: LeanProduct,
  ): QuantityDiscountTier[] {
    return discountLadder(
      rules,
      product._id.toHexString(),
      product.categoryIds.map((id) => id.toHexString()),
    );
  }

  /**
   * As regras de desconto por quantidade que podem valer para estes produtos.
   *
   * Uma consulta para a página inteira, e não uma por card: são poucas regras
   * no total, e resolver qual vale para cada produto e conta de memória.
   */
  private async rulesFor(products: readonly LeanProduct[]): Promise<QuantityDiscountRule[]> {
    if (products.length === 0) {
      return [];
    }

    const found = await this.discounts
      .find({
        isActive: true,
        $or: [
          { productId: { $in: products.map((product) => product._id) } },
          { categoryId: { $in: products.flatMap((product) => product.categoryIds) } },
        ],
      })
      .lean<QuantityDiscount[]>()
      .exec();

    return found.map((rule) => ({
      productId: rule.productId?.toHexString() ?? null,
      categoryId: rule.categoryId?.toHexString() ?? null,
      minQty: rule.minQty,
      percentOff: rule.percentOff,
    }));
  }

  /**
   * A categoria pedida no filtro, com as subcategorias dela.
   *
   * O menu exibe "Perfumes (12)" somando os filhos; filtrar só pelo id do pai
   * abriria a categoria vazia logo depois de prometer doze produtos.
   *
   * Endereço antigo também resolve, sem redirecionamento: aqui a categoria e
   * um filtro, não a página — quem chegou por um link velho vê a lista certa.
   */
  private async categoryBranch(slug: string): Promise<Types.ObjectId[]> {
    const wanted = slugify(slug);
    const category = await this.categories
      .findOne({ isActive: true, $or: [{ slug: wanted }, { previousSlugs: wanted }] })
      .select('_id parentId')
      .exec();

    if (!category) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
    }

    // Subcategoria não tem filhos: nem consulta.
    const children = category.parentId
      ? []
      : await this.categories
          .find({ parentId: category._id, isActive: true })
          .select('_id')
          .exec();

    return [category._id, ...children.map((child) => child._id)];
  }
}
