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

/**
 * Um degrau do desconto progressivo: "leve 3 e ganhe 10%".
 *
 * O card anuncia um so — o primeiro da escada, de menor quantidade, que e o
 * que o backend ja escolhe e manda em `quantityDiscount`. A escada inteira
 * so aparece na pagina do produto.
 */
export interface QuantityDiscountTier {
  minQty: number;
  percentOff: number;
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
  /** A chamada de desconto progressivo. `null` quando nao ha regra. */
  quantityDiscount: QuantityDiscountTier | null;
}

/** Uma pagina de resultados, no formato que a API devolve. */
export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
}

/** Categoria no fio de pao da pagina do produto. */
export interface PublicProductCategory {
  id: string;
  name: string;
  slug: string;
}

/**
 * O produto na pagina dele: tudo do card, mais o que so ela mostra.
 *
 * Existe aqui antes de a pagina existir porque o card ja a prebusca no hover
 * — e prebuscar sem tipo significaria gravar no cache, sob a chave
 * `catalogKeys.product`, um objeto de formato diferente do que a tela vai
 * pedir depois. A chave e a mesma; o tipo precisa ser o mesmo tambem.
 */
export interface PublicProductDetail extends PublicProduct {
  description: string;
  categories: PublicProductCategory[];
  /** A escada inteira, para a pagina mostrar quanto se ganha levando mais. */
  quantityDiscounts: QuantityDiscountTier[];
  related: PublicProduct[];
}

/**
 * O que `GET /categories/:slug` devolve quando o endereco mudou de nome.
 *
 * O backend responde `301` com `Location`, e o `fetch` do navegador segue o
 * redirecionamento sozinho — este formato so aparece para quem nao segue.
 * Esta declarado para que o discriminante (`'location' in resposta`) tenha
 * tipo, e nao para ser o caso comum.
 */
export interface MovedCategory {
  slug: string;
  location: string;
}
