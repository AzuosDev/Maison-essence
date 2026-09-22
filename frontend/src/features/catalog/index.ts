export {
  SUGGESTION_LIMIT,
  fetchCategoryTree,
  fetchProducts,
  fetchShelf,
  fetchSuggestions,
  type ShelfName,
} from './catalog.api';

export { catalogKeys, type ProductListParams } from './catalog.keys';

export type {
  CategoryTree,
  Paginated,
  PriceRange,
  PublicCategory,
  PublicProduct,
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

export { MIN_SEARCH_LENGTH, useCategoryTree, useSearchSuggestions, useShelf } from './use-catalog';
