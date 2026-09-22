/**
 * O catalogo como a vitrine o recebe.
 *
 * Espelho das views publicas do backend. So o que a moldura da loja usa por
 * enquanto: a arvore de categorias do menu e o produto no formato do card,
 * que e o que as sugestoes da busca mostram.
 */

/** Categoria como o menu a desenha. */
export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  /** `publicId` do Cloudinary. Vazio quando a categoria nao tem foto. */
  image: string;
  /** Produtos ativos. No pai, ja somados os das subcategorias. */
  productCount: number;
}

/** Um nivel de aninhamento, e so um: subcategoria nao tem filhos. */
export type WithChildren<T> = T & { children: T[] };

export type CategoryTree = WithChildren<PublicCategory>;

export interface PriceRange {
  min: number;
  max: number;
}

/** Variante como o cliente a ve. */
export interface PublicVariant {
  id: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  discountPercent: number;
  stock: number;
  isAvailable: boolean;
  onDemand: boolean;
  image: string;
}

/** Produto no card da vitrine — e na sugestao da busca. */
export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  brand: string;
  images: string[];
  coverImage: string;
  variants: PublicVariant[];
  hasVariants: boolean;
  priceRangeCents: PriceRange;
  discountPercent: number;
  inStock: boolean;
  isFeatured: boolean;
  isReadyToShip: boolean;
  tags: string[];
}

/** Uma pagina de resultados, no formato que a API devolve. */
export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
}
