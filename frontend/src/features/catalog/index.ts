export {
  SUGGESTION_LIMIT,
  fetchCategory,
  fetchCategoryTree,
  fetchProduct,
  fetchProducts,
  fetchShelf,
  fetchSuggestions,
  type ShelfName,
} from './catalog.api';

export {
  EMPTY_FILTERS,
  MAX_API_PAGE_SIZE,
  PAGE_SIZE,
  SORT_KEYS,
  SORT_LABELS,
  apiParamsFrom,
  clearedFilters,
  countActiveFilters,
  filtersFromSearch,
  searchFromFilters,
  type CatalogContext,
  type CatalogFilters,
  type SortKey,
} from './catalog.filters';

export { catalogKeys, type ProductListParams } from './catalog.keys';

export type {
  CategoryTree,
  MovedCategory,
  Paginated,
  PriceRange,
  PublicCategory,
  PublicProduct,
  PublicProductCategory,
  PublicProductDetail,
  PublicVariant,
  QuantityDiscountTier,
  WithChildren,
} from './catalog.types';

export {
  compareAtCents,
  displayVariant,
  quantityDiscountLabel,
  soleVariant,
} from './product-display';

export {
  LOW_STOCK_THRESHOLD,
  ON_DEMAND_MAX_QUANTITY,
  defaultVariant,
  galleryOf,
  imageIndexOf,
  isLowStock,
  linePricing,
  maxQuantityOf,
  nextTierFor,
  tierFor,
  variantById,
  type LinePricing,
} from './product-detail';

export { brandsOf, ceilingOf, pagedSlice, saleSlice, type ListSlice } from './product-list';

export { metaDescriptionOf, productJsonLd, productMeta } from './product-seo';

/**
 * Os hooks estao em dois arquivos, e a divisao e de empacotamento.
 *
 * `use-catalog.ts` e alcancavel a partir da moldura da loja: a caixa de
 * busca do cabecalho importa `useSearchSuggestions` daqui, e o cabecalho
 * esta em toda pagina. Tudo o que aquele modulo importar entra no pedaco
 * inicial junto com ele — inclusive para quem so abriu a home.
 *
 * Por isso os hooks que dependem de `catalog.filters` moram em
 * `use-product-list.ts`: a tabela de ordenacao, a tradutora de parametros e
 * a montagem da lista nao tem por que pesar no primeiro carregamento de quem
 * ainda nao abriu a vitrine. A conta, medida no build: 2,4 kB comprimidos
 * fora do caminho critico.
 *
 * A regra para manter: hook que importa de `catalog.filters` vai para
 * `use-product-list.ts`; o que a moldura usa fica em `use-catalog.ts`.
 */
export {
  MIN_SEARCH_LENGTH,
  asCategory,
  useCategory,
  useCategoryTree,
  usePrefetchProduct,
  useProduct,
  useSearchSuggestions,
  useShelf,
} from './use-catalog';

export {
  useCatalogFacets,
  useProductList,
  type CatalogFacets,
  type ProductListView,
} from './use-product-list';
