/**
 * O catálogo como a vitrine o recebe.
 *
 * Espelho das views públicas do backend. Só o que a moldura da loja usa por
 * enquanto: a árvore de categorias do menu e o produto no formato do card,
 * que e o que as sugestões da busca mostram.
 */

/** Categoria como o menu a desenha. */
export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  /** `publicId` do Cloudinary. Vazio quando a categoria não tem foto. */
  image: string;
  /** Produtos ativos. No pai, já somados os das subcategorias. */
  productCount: number;
}

/** Um nível de aninhamento, e só um: subcategoria não tem filhos. */
export type WithChildren<T> = T & { children: T[] };

export type CategoryTree = WithChildren<PublicCategory>;

export interface PriceRange {
  min: number;
  max: number;
}

/**
 * Um degrau do desconto progressivo: "leve 3 e ganhe 10%".
 *
 * O card anuncia um só — o primeiro da escada, de menor quantidade, que e o
 * que o backend já escolhe e manda em `quantityDiscount`. A escada inteira
 * só aparece na página do produto.
 */
export interface QuantityDiscountTier {
  minQty: number;
  percentOff: number;
}

/** Variante como o cliente a vê. */
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

/** Produto no card da vitrine — e na sugestão da busca. */
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
  /** A chamada de desconto progressivo. `null` quando não há regra. */
  quantityDiscount: QuantityDiscountTier | null;
}

/** Uma página de resultados, no formato que a API devolve. */
export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
}

/** Categoria no fio de pão da página do produto. */
export interface PublicProductCategory {
  id: string;
  name: string;
  slug: string;
}

/**
 * O produto na página dele: tudo do card, mais o que só ela mostra.
 *
 * Existe aqui antes de a página existir porque o card já a prebusca no hover
 * — e prebuscar sem tipo significaria gravar no cache, sob a chave
 * `catalogKeys.product`, um objeto de formato diferente do que a tela vai
 * pedir depois. A chave e a mesma; o tipo precisa ser o mesmo também.
 */
export interface PublicProductDetail extends PublicProduct {
  description: string;
  categories: PublicProductCategory[];
  /** A escada inteira, para a página mostrar quanto se ganha levando mais. */
  quantityDiscounts: QuantityDiscountTier[];
  related: PublicProduct[];
}

/**
 * O que `GET /categories/:slug` devolve quando o endereço mudou de nome.
 *
 * O backend responde `301` com `Location`, e o `fetch` do navegador segue o
 * redirecionamento sozinho — este formato só aparece para quem não segue.
 * Esta declarado para que o discriminante (`'location' in resposta`) tenha
 * tipo, e não para ser o caso comum.
 */
export interface MovedCategory {
  slug: string;
  location: string;
}
