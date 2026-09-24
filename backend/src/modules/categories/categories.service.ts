import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage } from 'mongoose';
import { Types } from 'mongoose';
import { slugify } from '../../database/slug.js';
import { Category, Product } from '../../schemas.js';
import { CATEGORY_NOT_FOUND_MESSAGE, MAX_PREVIOUS_SLUGS } from './categories.constants.js';
import { branchesOf } from './category.tree.js';
import {
  directCount,
  toCategoryTree,
  toCategoryView,
  toPublicCategoryTree,
  toPublicCategoryView,
} from './category.view.js';
import type {
  CategoryView,
  ProductCounts,
  PublicCategoryView,
  WithChildren,
} from './category.view.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { ReorderCategoriesDto } from './dto/reorder-categories.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { CategoryDocument } from './schemas/category.schema.js';

export const SLUG_TAKEN_MESSAGE = 'Já existe uma categoria nesse endereço. Escolha outro.';
export const PARENT_NOT_FOUND_MESSAGE = 'Categoria pai não encontrada.';
export const NESTING_TOO_DEEP_MESSAGE =
  'Uma subcategoria não pode ter filhos: escolha uma categoria principal como pai.';
export const SELF_PARENT_MESSAGE = 'Uma categoria não pode ser subcategoria de si mesma.';
export const HAS_CHILDREN_MESSAGE =
  'Esta categoria tem subcategorias e por isso não pode virar subcategoria de outra.';
export const DUPLICATED_IDS_MESSAGE = 'A lista de ordem tem categorias repetidas.';
export const UNKNOWN_IDS_MESSAGE =
  'A lista de ordem cita categoria que não existe. Recarregue a página e tente de novo.';

/**
 * O que a busca publica por slug encontrou.
 *
 * `moved` e o endereco antigo: existe, mas nao e mais o atual. Quem responde a
 * rota transforma isso em um 301 — o link ja compartilhado continua abrindo a
 * categoria certa em vez de morrer em 404.
 */
export type SlugLookup =
  | { outcome: 'found'; category: WithChildren<PublicCategoryView> }
  | { outcome: 'moved'; slug: string };

interface CountRow {
  _id: Types.ObjectId;
  count: number;
}

const DUPLICATE_KEY = 11000;

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
  ) {}

  /** Arvore do painel: ativas e inativas, para a dona poder reativar. */
  async list(): Promise<WithChildren<CategoryView>[]> {
    const all = await this.categories.find().exec();

    return toCategoryTree(branchesOf(all), await this.productCounts(all));
  }

  /** Arvore do menu da loja: so o que esta ativo. */
  async publicTree(): Promise<WithChildren<PublicCategoryView>[]> {
    const active = await this.categories.find({ isActive: true }).exec();

    return toPublicCategoryTree(branchesOf(active), await this.productCounts(active));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryView> {
    const parentId = await this.resolveParent(dto.parentId ?? null, null);

    if (dto.slug !== undefined) {
      await this.assertSlugIsFree(dto.slug);
    }

    const created = new this.categories({
      name: dto.name,
      // Vazio de proposito quando nao veio: o hook do schema gera o slug a
      // partir do nome, desviando para `nome-2` se o endereco ja estiver
      // ocupado. Slug digitado a mao nao desvia — ali a colisao e um 409.
      slug: dto.slug ?? '',
      parentId,
      image: dto.image ?? '',
      order: dto.order ?? 0,
      isActive: dto.isActive ?? true,
    });

    // Categoria recem-criada nao tem produto: nao ha o que contar.
    return toCategoryView(await this.save(created), 0);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryView> {
    const category = await this.findById(id);

    if (dto.parentId !== undefined) {
      category.parentId = await this.resolveParent(dto.parentId, category._id);
    }

    if (dto.slug !== undefined && dto.slug !== category.slug) {
      await this.assertSlugIsFree(dto.slug, category._id);
      category.previousSlugs = rememberSlug(category, dto.slug);
      category.slug = dto.slug;
    }

    if (dto.name !== undefined) {
      category.name = dto.name;
    }

    if (dto.image !== undefined) {
      category.image = dto.image;
    }

    if (dto.order !== undefined) {
      category.order = dto.order;
    }

    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    const saved = await this.save(category);

    return toCategoryView(saved, await this.countProductsOf(saved));
  }

  /**
   * Regrava a posicao de todas as categorias citadas em uma operacao so.
   *
   * `bulkWrite` em vez de um `save` por categoria: arrastar um item no painel
   * remexe a lista inteira, e cada ida ao Atlas custa caro na funcao
   * serverless. A posicao e o indice na lista, entao o painel manda a ordem
   * que o usuario ve na tela e nao precisa calcular numero nenhum.
   */
  async reorder(dto: ReorderCategoriesDto): Promise<WithChildren<CategoryView>[]> {
    if (new Set(dto.ids).size !== dto.ids.length) {
      throw new UnprocessableEntityException(DUPLICATED_IDS_MESSAGE);
    }

    const ids = dto.ids.map((id) => new Types.ObjectId(id));
    const existing = await this.categories.countDocuments({ _id: { $in: ids } }).exec();

    if (existing !== ids.length) {
      throw new UnprocessableEntityException(UNKNOWN_IDS_MESSAGE);
    }

    await this.categories.bulkWrite(
      ids.map((objectId, index) => ({
        updateOne: { filter: { _id: objectId }, update: { $set: { order: index } } },
      })),
    );

    return this.list();
  }

  /**
   * Exclui, desde que a categoria esteja vazia — sem subcategoria e sem
   * produto ativo.
   *
   * O 409 leva a contagem junto porque a pergunta seguinte da dona e sempre
   * "quantos?", e oferece desativar, que costuma ser o que ela queria: some do
   * menu da loja e nenhum produto sai do lugar.
   */
  async remove(id: string): Promise<void> {
    const category = await this.findById(id);
    const [subcategoryCount, productCount] = await Promise.all([
      this.categories.countDocuments({ parentId: category._id }).exec(),
      this.countProductsOf(category),
    ]);

    if (subcategoryCount > 0) {
      throw new ConflictException({
        message: subcategoriesMessage(subcategoryCount),
        details: { subcategoryCount, productCount, canDeactivate: true },
      });
    }

    if (productCount > 0) {
      throw new ConflictException({
        message: productsMessage(productCount),
        details: { subcategoryCount: 0, productCount, canDeactivate: true },
      });
    }

    // Produto inativo pode continuar apontando para ela. Soltar a referencia
    // aqui evita um id morto no `categoryIds` de quem for reativado depois.
    await this.products
      .updateMany({ categoryIds: category._id }, { $pull: { categoryIds: category._id } })
      .exec();

    await category.deleteOne();
  }

  /**
   * Resolve o endereco publico de uma categoria.
   *
   * Procura primeiro no endereco atual e so depois no historico: se um slug
   * aposentado por uma categoria virou o slug atual de outra, quem responde e
   * a que esta usando o endereco agora.
   */
  async findPublicBySlug(slug: string): Promise<SlugLookup> {
    const wanted = slugify(slug);
    const current = await this.categories.findOne({ slug: wanted, isActive: true }).exec();

    if (current) {
      return { outcome: 'found', category: await this.toPublicNode(current) };
    }

    const renamed = await this.categories
      .findOne({ previousSlugs: wanted, isActive: true })
      .exec();

    if (renamed) {
      return { outcome: 'moved', slug: renamed.slug };
    }

    throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
  }

  /** A categoria com as subcategorias ativas dela, do jeito que a loja exibe. */
  private async toPublicNode(
    category: CategoryDocument,
  ): Promise<WithChildren<PublicCategoryView>> {
    // Subcategoria nao tem filhos: nem consulta.
    const children = category.parentId
      ? []
      : await this.categories
          .find({ parentId: category._id, isActive: true })
          .sort({ order: 1, name: 1 })
          .exec();
    const counts = await this.productCounts([category, ...children]);
    const childViews = children.map((child) =>
      toPublicCategoryView(child, directCount(child, counts)),
    );
    const total = childViews.reduce(
      (sum, child) => sum + child.productCount,
      directCount(category, counts),
    );

    return { ...toPublicCategoryView(category, total), children: childViews };
  }

  /**
   * Quantos produtos ativos cada categoria tem, em uma agregacao so.
   *
   * O `$unwind` abre o `categoryIds` do produto em uma linha por categoria, e
   * o segundo `$match` descarta as que nao estao sendo exibidas — um produto
   * costuma pertencer a mais de uma.
   */
  private async productCounts(categories: readonly CategoryDocument[]): Promise<ProductCounts> {
    if (categories.length === 0) {
      return new Map<string, number>();
    }

    const ids = categories.map((category) => category._id);
    const pipeline: PipelineStage[] = [
      { $match: { isActive: true, categoryIds: { $in: ids } } },
      { $unwind: '$categoryIds' },
      { $match: { categoryIds: { $in: ids } } },
      { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
    ];

    const rows = await this.products.aggregate<CountRow>(pipeline).exec();

    return new Map(rows.map((row) => [row._id.toHexString(), row.count]));
  }

  private countProductsOf(category: CategoryDocument): Promise<number> {
    return this.products.countDocuments({ isActive: true, categoryIds: category._id }).exec();
  }

  /**
   * Valida o pai escolhido e devolve o `_id` dele, ou `null` para categoria
   * principal.
   *
   * Sao tres regras, e as tres existem para manter a arvore com um nivel so: o
   * pai precisa existir, precisa ser uma categoria principal e quem ja tem
   * filhos nao pode descer de nivel.
   */
  private async resolveParent(
    parentId: string | null,
    self: Types.ObjectId | null,
  ): Promise<Types.ObjectId | null> {
    if (parentId === null) {
      return null;
    }

    const objectId = new Types.ObjectId(parentId);

    if (self?.equals(objectId)) {
      throw new UnprocessableEntityException(SELF_PARENT_MESSAGE);
    }

    const parent = await this.categories.findById(objectId).select('parentId').exec();

    if (!parent) {
      throw new UnprocessableEntityException(PARENT_NOT_FOUND_MESSAGE);
    }

    if (parent.parentId) {
      throw new UnprocessableEntityException(NESTING_TOO_DEEP_MESSAGE);
    }

    if (self && (await this.categories.exists({ parentId: self }))) {
      throw new UnprocessableEntityException(HAS_CHILDREN_MESSAGE);
    }

    return objectId;
  }

  /**
   * O endereco precisa estar livre inclusive no historico das outras
   * categorias: reaproveitar um slug aposentado faria o redirecionamento
   * antigo e a categoria nova disputarem o mesmo link.
   */
  private async assertSlugIsFree(slug: string, exceptId?: Types.ObjectId): Promise<void> {
    const existing = await this.categories
      .findOne({ $or: [{ slug }, { previousSlugs: slug }] })
      .select('_id')
      .exec();

    if (existing && !existing._id.equals(exceptId)) {
      throw new ConflictException(SLUG_TAKEN_MESSAGE);
    }
  }

  /** Busca pelo id, tratando id malformado como "nao encontrado". */
  private async findById(id: string): Promise<CategoryDocument> {
    const found = Types.ObjectId.isValid(id)
      ? await this.categories.findById(new Types.ObjectId(id)).exec()
      : null;

    if (!found) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
    }

    return found;
  }

  /** Salva traduzindo a colisao do indice unico de slug em 409. */
  private async save(category: CategoryDocument): Promise<CategoryDocument> {
    try {
      return await category.save();
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        throw new ConflictException(SLUG_TAKEN_MESSAGE);
      }

      throw error;
    }
  }
}

/**
 * Empurra o endereco atual para o historico, sem repetir e sem crescer para
 * sempre. O slug que esta sendo adotado sai da lista: ele e o atual agora, e
 * endereco nenhum redireciona para si mesmo.
 */
function rememberSlug(category: CategoryDocument, nextSlug: string): string[] {
  const kept = category.previousSlugs.filter(
    (slug) => slug !== nextSlug && slug !== category.slug,
  );

  return [...kept, category.slug].slice(-MAX_PREVIOUS_SLUGS);
}

function subcategoriesMessage(count: number): string {
  return count === 1
    ? 'Esta categoria tem 1 subcategoria. Exclua ou mova a subcategoria antes.'
    : `Esta categoria tem ${count} subcategorias. Exclua ou mova as subcategorias antes.`;
}

function productsMessage(count: number): string {
  const produtos = count === 1 ? '1 produto ativo' : `${count} produtos ativos`;

  return `Esta categoria tem ${produtos} e por isso não pode ser excluída. Desative a categoria para tira-lá do menu sem mexer nos produtos.`;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
