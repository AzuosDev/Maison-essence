export {
  SUGGESTION_LIMIT,
  fetchCategoryTree,
  fetchProducts,
  fetchSuggestions,
} from './catalog.api';

export { catalogKeys, type ProductListParams } from './catalog.keys';

export type {
  CategoryTree,
  Paginated,
  PriceRange,
  PublicCategory,
  PublicProduct,
  PublicVariant,
  WithChildren,
} from './catalog.types';

export { MIN_SEARCH_LENGTH, useCategoryTree, useSearchSuggestions } from './use-catalog';
