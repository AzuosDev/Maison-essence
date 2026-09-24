/** Estoque maximo por variante. Serve so para barrar digitacao absurda. */
export const MAX_STOCK = 1_000_000;

/** Quantas variantes um produto pode ter. Tamanho de tela, nao de negocio. */
export const MAX_VARIANTS = 50;

/** Quantas fotos por produto. */
export const MAX_IMAGES = 12;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PRODUCT_NOT_FOUND_MESSAGE = 'Produto não encontrado.';

/** Vitrine: uma pagina cheia na grade de quatro colunas. */
export const PUBLIC_PAGE_SIZE = 24;
export const MAX_PUBLIC_PAGE_SIZE = 48;

/** Quantos produtos cabem numa prateleira da home (destaques, mais vendidos). */
export const SHELF_SIZE = 12;

/** Quantos relacionados a pagina do produto exibe. */
export const RELATED_LIMIT = 8;
