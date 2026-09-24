import { slugify } from '../../database/slug.js';
import { CATALOG_ENVELOPE_MESSAGE, UNNAMED_ENTRY_SLUG } from './catalog-import.constants.js';

/**
 * A leitura do arquivo de catálogo.
 *
 * ## Por que este módulo não valida nada
 *
 * Ele só **acha** as coisas: separa o envelope, descobre qual e o slug de
 * cada entrada e resolve os nulos que o formato permite. Quem diz se a
 * entrada presta e o `CreateProductDto`, o mesmo que a rota do painel usa —
 * ter aqui uma segunda copia das regras seria garantir que as duas
 * divergissem no primeiro campo novo.
 *
 * Por isso os valores vão para o candidato **crus**, como estavam no arquivo.
 * Um `priceCents: "15500"` chega ao validador como string e volta com a frase
 * certa ("o preço deve ser um inteiro em centavos"), em vez de virar `NaN`
 * silencioso aqui dentro.
 *
 * ## O que o módulo resolve, então
 *
 * Duas coisas que o validador não teria como resolver sozinho:
 *
 * - **O slug**, que e a chave da idempotência. Sem ele não há o que procurar
 *   no banco nem o que escrever no relatório de falhas. Ausente, sai do nome,
 *   pelo mesmo `slugify` do schema.
 * - **O `null`**, que o arquivo usa onde a API usa a ausência do campo. Um
 *   `brand: null` não e "apague a marca", e "esta lista não informa marca";
 *   virasse `null` no candidato, o `@IsOptional` deixaria passar e a marca
 *   gravada seria apagada por omissão.
 */

/** Uma entrada do arquivo, pronta para validação. */
export interface CatalogEntry {
  /** Identidade e chave da idempotência. Nunca vazio. */
  slug: string;
  /** O corpo que o DTO da API valida. Valores crus, do jeito que vieram. */
  candidate: Record<string, unknown>;
}

export interface CategoryEntry extends CatalogEntry {
  /** `null` e categoria principal. A resolução para `parentId` e do serviço. */
  parentSlug: string | null;
}

export interface ProductEntry extends CatalogEntry {
  /** Resolvidos para `categoryIds` antes de validar. */
  categorySlugs: string[];
}

export class CatalogFormatError extends Error {
  constructor(message: string = CATALOG_ENVELOPE_MESSAGE) {
    super(message);
    this.name = 'CatalogFormatError';
  }
}

/**
 * Separa as duas listas do arquivo.
 *
 * Esta e a única leitura que pode derrubar a importação inteira, e por um
 * motivo simples: sem as listas não há o que importar nem o que relatar.
 * Tudo o que estiver **dentro** delas falha sozinho, uma entrada por vez.
 */
export function readCatalogEnvelope(raw: unknown): {
  categories: unknown[];
  products: unknown[];
} {
  const record = asRecord(raw);

  if (record === null) {
    throw new CatalogFormatError();
  }

  const { categories, products } = record;

  if (!Array.isArray(categories) || !Array.isArray(products)) {
    throw new CatalogFormatError();
  }

  return { categories, products };
}

/** Uma categoria do arquivo virando candidata a `CreateCategoryDto`. */
export function readCategoryEntry(raw: unknown): CategoryEntry {
  const record = asRecord(raw) ?? {};
  const slug = identityOf(record);
  const parentSlug = text(record.parentSlug);

  return {
    slug,
    parentSlug: parentSlug.length > 0 ? parentSlug : null,
    candidate: withoutNulls({
      name: record.name,
      // Explicito de propósito: sem ele o hook do schema geraria um endereço a
      // partir do nome, e a chave que a próxima importação procura deixaria de
      // ser previsível.
      slug,
      order: record.order,
      isActive: record.isActive,
    }),
  };
}

/** Um produto do arquivo virando candidato a `CreateProductDto`. */
export function readProductEntry(raw: unknown): ProductEntry {
  const record = asRecord(raw) ?? {};
  const slug = identityOf(record);

  return {
    slug,
    categorySlugs: Array.isArray(record.categorySlugs)
      ? record.categorySlugs.filter((value): value is string => typeof value === 'string')
      : [],
    candidate: withoutNulls({
      name: record.name,
      slug,
      brand: record.brand,
      description: record.description,
      images: record.images,
      tags: record.tags,
      isActive: record.isActive,
      isFeatured: record.isFeatured,
      isReadyToShip: record.isReadyToShip,
      variants: readVariants(record.variants),
      // `sourceCatalog` fica de fora: o produto não tem campo para guardar de
      // qual lista de fornecedor a linha veio, e inventar um mudaria o formato
      // que o painel le. O arquivo pode trazer, a importação ignora.
    }),
  };
}

/**
 * As variantes, uma a uma.
 *
 * Um valor que não seja lista volta como veio: e o validador que responde
 * "o produto precisa de ao menos uma variante" em português.
 */
function readVariants(raw: unknown): unknown {
  if (!Array.isArray(raw)) {
    return raw;
  }

  return raw.map((item) => {
    const record = asRecord(item) ?? {};

    return withoutNulls({
      sku: record.sku,
      label: record.label,
      priceCents: record.priceCents,
      // `null` aqui significa "esta lista não tem preço de comparação", e não
      // "apague o preço riscado que a dona cadastrou". Na API do painel o
      // `null` apaga; aqui a ausência preserva, que e a regra da importação.
      compareAtPriceCents: record.compareAtPriceCents,
      stock: record.stock,
      image: record.image,
      isActive: record.isActive,
      allowBackorder: record.allowBackorder,
    });
  });
}

/**
 * O slug da entrada: o declarado, o derivado do nome, ou o marcador.
 *
 * O marcador existe para a linha do relatório. Uma entrada sem nome nem slug
 * vai falhar na validação de qualquer jeito, e "produto sem nome" e uma
 * queixa mais útil do que uma linha em branco.
 */
function identityOf(record: Record<string, unknown>): string {
  const declared = slugify(text(record.slug));

  if (declared.length > 0) {
    return declared;
  }

  const derived = slugify(text(record.name));

  return derived.length > 0 ? derived : UNNAMED_ENTRY_SLUG;
}

/** Tira do candidato as chaves nulas ou ausentes, preservando `0` e `false`. */
function withoutNulls(candidate: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(candidate).filter(([, value]) => value !== null && value !== undefined),
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
