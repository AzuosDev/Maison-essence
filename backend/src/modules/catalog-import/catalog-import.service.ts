import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ValidationError } from 'class-validator';
import type { ClientSession, Connection, Model } from 'mongoose';
import { Types } from 'mongoose';
import { AUDIT_ACTIONS, AUDIT_TARGETS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditActor } from '../audit/audit.types.js';
import { CreateCategoryDto } from '../categories/dto/create-category.dto.js';
import {
  NESTING_TOO_DEEP_MESSAGE,
  PARENT_NOT_FOUND_MESSAGE,
} from '../categories/categories.service.js';
import { Category } from '../categories/schemas/category.schema.js';
import { CreateProductDto } from '../products/dto/create-product.dto.js';
import { Product } from '../products/schemas/product.schema.js';
import type { ProductDocument } from '../products/schemas/product.schema.js';
import { IMPORT_BATCH_SIZE } from './catalog-import.constants.js';
import { readCatalogEnvelope, readCategoryEntry, readProductEntry } from './catalog-file.js';
import type { CategoryEntry, ProductEntry } from './catalog-file.js';
import { mergeCategory, mergeProduct } from './catalog-merge.js';
import type { ProductData, StoredProduct } from './catalog-merge.js';
import { emptyReport } from './catalog-report.js';
import type { CatalogImportReport } from './catalog-report.js';

export interface ImportOptions {
  /** Simula: lê tudo, monta o relatório inteiro e não grava nada. */
  dryRun?: boolean;
  /** Importa um produto só, pelo slug. As categorias continuam entrando. */
  only?: string;
  /**
   * Quanto tempo a importação pode levar antes de parar num limite de lote.
   *
   * Existe por causa da função serverless, que e morta pelo relógio sem
   * chance de responder nada. Chegando no teto, a importação para **entre
   * dois lotes** — com produtos inteiros gravados — e devolve o relatório
   * dizendo quantos faltaram. Como ela e idempotente, mandar o mesmo arquivo
   * de novo continua de onde parou.
   */
  deadlineMs?: number;
  actor?: AuditActor;
}

/** Entrada que não entrou. A mensagem vai crua para o relatório. */
export class CatalogEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogEntryError';
  }
}

/**
 * A importação do catálogo.
 *
 * ## O mesmo motor para os dois caminhos
 *
 * `npm run seed:catalog` e `POST /admin/catalog/import` chamam este serviço.
 * Não há uma "versão do script" e uma "versão da rota": a dona não tem shell
 * na Vercel, e um caminho que só o desenvolvedor testa e o caminho que quebra
 * no dia em que ela precisa.
 *
 * ## Uma entrada ruim não derruba as outras
 *
 * Cada produto e validado pelo `CreateProductDto` — o mesmo da rota do painel,
 * não uma copia — e uma reprovação vira uma linha no relatório, com slug e
 * motivo, enquanto a importação segue. Uma lista de 269 produtos com um preço
 * digitado errado precisa importar 268; abortar tudo seria transformar um erro
 * de digitação numa tarde perdida.
 *
 * ## Transação quando o cluster deixa
 *
 * Transação no Mongo exige replica set. O Atlas tem; um `mongod` solto, não —
 * e e num `mongod` solto que os testes rodam. Então a importação pergunta ao
 * servidor antes: havendo suporte, tudo entra ou nada entra; não havendo, ela
 * grava direto e guarda os ids do que criou, que e a única forma de desfazer
 * uma importação interrompida.
 */
@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger('CatalogImport');

  constructor(
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectConnection() private readonly connection: Connection,
    private readonly audit: AuditService,
  ) {}

  async import(raw: unknown, options: ImportOptions = {}): Promise<CatalogImportReport> {
    const started = Date.now();
    const envelope = readCatalogEnvelope(raw);
    const dryRun = options.dryRun ?? false;
    // A simulação nunca abre sessão: ela não grava, e uma transação aberta
    // para ser abortada custaria uma ida ao servidor por nada.
    const transactional = !dryRun && (await this.supportsTransactions());

    let report = emptyReport();

    if (transactional) {
      const session = await this.connection.startSession();

      try {
        await session.withTransaction(async () => {
          // Dentro do callback porque `withTransaction` repete a tentativa em
          // erro transitório: um relatório montado fora somaria duas vezes.
          report = emptyReport();
          report.transactional = true;

          await this.run(envelope, options, report, session);
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Sem transação, os ids do que nasceu são a única forma de desfazer uma
      // importação que parou no meio. Na simulação não nasce nada.
      if (!dryRun) {
        report.rollback = { categoryIds: [], productIds: [] };
      }

      await this.run(envelope, options, report, null);
    }

    report.dryRun = dryRun;
    report.durationMs = Date.now() - started;

    await this.recordAudit(report, options);

    return report;
  }

  /** Categorias primeiro: um produto sem elas não tem onde se encaixar. */
  private async run(
    envelope: { categories: unknown[]; products: unknown[] },
    options: ImportOptions,
    report: CatalogImportReport,
    session: ClientSession | null,
  ): Promise<void> {
    const started = Date.now();
    const ids = await this.importCategories(envelope.categories, options, report, session);

    await this.importProducts(envelope.products, ids, options, report, session, started);
  }

  /* ---- Categorias --------------------------------------------------------- */

  /**
   * Importa as categorias e devolve o mapa slug -> id.
   *
   * As raizes primeiro, as filhas depois: uma subcategoria precisa que a mãe
   * exista para apontar para ela, e o arquivo não garante ordem nenhuma.
   */
  private async importCategories(
    raw: readonly unknown[],
    options: ImportOptions,
    report: CatalogImportReport,
    session: ClientSession | null,
  ): Promise<Map<string, string>> {
    const entries = raw.map(readCategoryEntry);
    const ids = new Map<string, string>();
    const roots = new Set<string>();

    for (const entry of [...entries.filter(isRoot), ...entries.filter((e) => !isRoot(e))]) {
      try {
        const parentId = await this.resolveParent(entry, ids, roots, session);
        const id = await this.importCategory(entry, parentId, options, report, session);

        ids.set(entry.slug, id);

        if (parentId === null) {
          roots.add(entry.slug);
        }
      } catch (error: unknown) {
        report.categories.failed += 1;
        report.failures.push({ slug: entry.slug, reason: reasonOf(error) });
      }
    }

    return ids;
  }

  private async importCategory(
    entry: CategoryEntry,
    parentId: string | null,
    options: ImportOptions,
    report: CatalogImportReport,
    session: ClientSession | null,
  ): Promise<string> {
    const dto = await validateAs(CreateCategoryDto, entry.candidate);
    const stored = await this.categories.findOne({ slug: entry.slug }).session(session).exec();
    // Campo a campo, e não por espalhamento: o que atravessa da validação
    // para a fusão fica escrito, e um campo novo no DTO não entra aqui de
    // carona sem alguém decidir o que ele faz numa reimportação.
    const data = mergeCategory(
      { name: dto.name, slug: entry.slug, order: dto.order, isActive: dto.isActive },
      parentId,
      stored,
    );
    const document = stored ?? new this.categories();

    document.set({
      ...data,
      parentId: data.parentId === null ? null : new Types.ObjectId(data.parentId),
    });

    // A simulação para aqui, um passo antes do banco: ela já leu o que existe,
    // já fundiu e já sabe o que teria acontecido — que e o relatório inteiro.
    if (options.dryRun !== true) {
      await document.save({ session });
    }

    if (stored === null) {
      report.categories.created += 1;
      report.rollback?.categoryIds.push(document._id.toHexString());
    } else {
      report.categories.updated += 1;
    }

    return document._id.toHexString();
  }

  /**
   * O `parentId` de uma categoria do arquivo.
   *
   * A mãe pode vir no mesmo arquivo (e já esta no mapa) ou já estar no banco
   * de antes. As duas regras da árvore de um nível só continuam valendo aqui,
   * com as mesmas frases da rota do painel: a mãe precisa existir e precisa
   * ser uma categoria principal.
   */
  private async resolveParent(
    entry: CategoryEntry,
    ids: ReadonlyMap<string, string>,
    roots: ReadonlySet<string>,
    session: ClientSession | null,
  ): Promise<string | null> {
    if (entry.parentSlug === null) {
      return null;
    }

    const known = ids.get(entry.parentSlug);

    if (known !== undefined) {
      if (!roots.has(entry.parentSlug)) {
        throw new CatalogEntryError(NESTING_TOO_DEEP_MESSAGE);
      }

      return known;
    }

    const parent = await this.categories
      .findOne({ slug: entry.parentSlug })
      .select('_id parentId')
      .session(session)
      .exec();

    if (parent === null) {
      throw new CatalogEntryError(`${PARENT_NOT_FOUND_MESSAGE} Slug: ${entry.parentSlug}.`);
    }

    if (parent.parentId !== null) {
      throw new CatalogEntryError(NESTING_TOO_DEEP_MESSAGE);
    }

    return parent._id.toHexString();
  }

  /* ---- Produtos ----------------------------------------------------------- */

  private async importProducts(
    raw: readonly unknown[],
    categoryIds: ReadonlyMap<string, string>,
    options: ImportOptions,
    report: CatalogImportReport,
    session: ClientSession | null,
    startedAt: number,
  ): Promise<void> {
    const only = options.only;
    const entries = raw
      .map(readProductEntry)
      .filter((entry) => only === undefined || entry.slug === only);
    const seen = new Set<string>();

    for (let start = 0; start < entries.length; start += IMPORT_BATCH_SIZE) {
      if (this.outOfTime(options, startedAt)) {
        report.remaining = entries.length - start;
        this.logger.warn(
          `Tempo esgotado: ${report.remaining} produtos ficaram para a próxima chamada.`,
        );

        return;
      }

      for (const entry of entries.slice(start, start + IMPORT_BATCH_SIZE)) {
        try {
          await this.importProduct(entry, categoryIds, seen, options, report, session);
        } catch (error: unknown) {
          report.products.failed += 1;
          report.failures.push({ slug: entry.slug, reason: reasonOf(error) });
        }
      }
    }
  }

  private async importProduct(
    entry: ProductEntry,
    categoryIds: ReadonlyMap<string, string>,
    seen: Set<string>,
    options: ImportOptions,
    report: CatalogImportReport,
    session: ClientSession | null,
  ): Promise<void> {
    if (seen.has(entry.slug)) {
      // Dois produtos com o mesmo endereço: o segundo sobrescreveria o
      // primeiro e a importação pareceria ter dado certo.
      throw new CatalogEntryError('Este endereço aparece mais de uma vez no arquivo.');
    }

    seen.add(entry.slug);

    const dto = await validateAs(CreateProductDto, {
      ...entry.candidate,
      categoryIds: resolveCategories(entry, categoryIds),
    });
    const stored = await this.products.findOne({ slug: entry.slug }).session(session).exec();
    const merge = mergeProduct(
      {
        name: dto.name,
        slug: entry.slug,
        brand: dto.brand,
        description: dto.description,
        categoryIds: dto.categoryIds,
        images: dto.images,
        tags: dto.tags,
        isActive: dto.isActive,
        isFeatured: dto.isFeatured,
        isReadyToShip: dto.isReadyToShip,
        variants: dto.variants,
      },
      stored === null ? null : toStoredProduct(stored),
    );
    const document = stored ?? new this.products();

    write(document, merge.data);

    if (options.dryRun !== true) {
      await document.save({ session });
    }

    report.variants.created += merge.variantsCreated;
    report.variants.deactivated += merge.variantsDeactivated;

    if (stored === null) {
      report.products.created += 1;
      report.rollback?.productIds.push(document._id.toHexString());
    } else {
      report.products.updated += 1;
    }
  }

  /* ---- Transação e relógio ------------------------------------------------ */

  /**
   * Se este cluster aceita transação.
   *
   * A pergunta vai ao servidor em vez de ser tentada e falhada no meio da
   * primeira gravação: `setName` e replica set, `isdbgrid` e um mongos. Um
   * `mongod` solto — o do desenvolvimento e o dos testes — não tem nenhum dos
   * dois, e e ele que cai no caminho sem transação.
   */
  private async supportsTransactions(): Promise<boolean> {
    try {
      const info = await this.connection.db?.admin().command({ hello: 1 });

      return typeof info?.setName === 'string' || info?.msg === 'isdbgrid';
    } catch (error: unknown) {
      this.logger.warn(`Não deu para saber se o cluster tem transação: ${reasonOf(error)}`);

      return false;
    }
  }

  private outOfTime(options: ImportOptions, startedAt: number): boolean {
    return options.deadlineMs !== undefined && Date.now() - startedAt >= options.deadlineMs;
  }

  /**
   * Uma entrada de trilha por importação, não uma por produto.
   *
   * O preço muda em massa aqui, e a rota do painel registra cada troca de
   * preço justamente porque preço que muda sem ninguém saber vira briga no
   * WhatsApp. Duzentas e sessenta e nove entradas responderiam pior do que
   * uma: quem investiga quer saber que o catálogo foi importado, por quem e
   * quando — a lista de preços esta no arquivo que foi importado.
   */
  private async recordAudit(
    report: CatalogImportReport,
    options: ImportOptions,
  ): Promise<void> {
    if (options.dryRun === true || options.actor === undefined) {
      return;
    }

    await this.audit.record({
      action: AUDIT_ACTIONS.CATALOG_IMPORTED,
      actor: options.actor,
      target: { kind: AUDIT_TARGETS.CATALOG, id: '', label: 'Catálogo' },
      details: {
        categories: report.categories,
        products: report.products,
        variants: report.variants,
        failed: report.failures.map((failure) => failure.slug),
        ...(options.only === undefined ? {} : { only: options.only }),
      },
    });
  }
}

/* ---- Auxiliares ------------------------------------------------------------ */

function isRoot(entry: CategoryEntry): boolean {
  return entry.parentSlug === null;
}

/** Grava a fusão no documento, com as chaves só quando o produto nasce. */
function write(document: ProductDocument, data: ProductData): void {
  document.set({
    name: data.name,
    slug: data.slug,
    brand: data.brand,
    description: data.description,
    categoryIds: data.categoryIds.map((id) => new Types.ObjectId(id)),
    images: data.images,
    tags: data.tags,
    ...data.flags,
  });

  // Em `set` próprio: a lista de variantes e substituida inteira, e misturar a
  // troca com os campos simples esconderia isso de quem lê.
  document.set({ variants: data.variants });
}

/** Os `categoryIds` do produto, ou a queixa nomeando a categoria que falta. */
function resolveCategories(
  entry: ProductEntry,
  categoryIds: ReadonlyMap<string, string>,
): string[] {
  return entry.categorySlugs.map((slug) => {
    const id = categoryIds.get(slug);

    if (id === undefined) {
      throw new CatalogEntryError(`A categoria ${slug} não existe.`);
    }

    return id;
  });
}

/** O produto gravado, reduzido ao que a fusão precisa enxergar. */
function toStoredProduct(product: ProductDocument): StoredProduct {
  return {
    name: product.name,
    brand: product.brand,
    description: product.description,
    categoryIds: product.categoryIds.map((id) => id.toHexString()),
    images: [...product.images],
    tags: [...product.tags],
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      label: variant.label,
      priceCents: variant.priceCents,
      compareAtPriceCents: variant.compareAtPriceCents,
      stock: variant.stock,
      image: variant.image,
      isActive: variant.isActive,
      allowBackorder: variant.allowBackorder,
    })),
  };
}

/**
 * Valida com o DTO da API, com as mesmas opções do pipe global.
 *
 * Mesmas opções importa: `whitelist` sem `forbidNonWhitelisted` aceitaria
 * calado um campo escrito errado no arquivo, e a importação passaria semanas
 * ignorando um dado que quem escreveu o arquivo acha que esta gravando.
 */
async function validateAs<T extends object>(
  Dto: new () => T,
  candidate: Record<string, unknown>,
): Promise<T> {
  const instance = plainToInstance(Dto, candidate);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

  if (errors.length > 0) {
    throw new CatalogEntryError(describeErrors(errors).join(' '));
  }

  return instance;
}

/** As queixas do validador em uma frase, inclusive as das variantes. */
function describeErrors(errors: readonly ValidationError[], path = ''): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const here = path === '' ? error.property : `${path}.${error.property}`;

    for (const message of Object.values(error.constraints ?? {})) {
      messages.push(`${here}: ${message}.`);
    }

    if (error.children !== undefined && error.children.length > 0) {
      messages.push(...describeErrors(error.children, here));
    }
  }

  return messages;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
