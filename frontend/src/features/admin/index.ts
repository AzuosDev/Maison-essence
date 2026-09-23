export {
  createProduct,
  deleteProduct,
  fetchAdminProduct,
  fetchOrder,
  listAdminCategories,
  listOrders,
  listProducts,
  updateOrderNotes,
  updateOrderStatus,
  updateProduct,
  updateProductStatus,
} from './admin.api';

export {
  confirmUpload,
  createUploadSignature,
  deleteUpload,
  uploadToCloudinary,
} from './uploads.api';

export { adminKeys, type AdminOrderListParams, type AdminProductListParams } from './admin.keys';

export {
  ADMIN_MAX_PAGE_SIZE,
  ADMIN_PAGE_SIZE,
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PRODUCT_LIMITS,
  PRODUCT_STATUS_FILTERS,
  SOLD_ORDER_STATUSES,
  UPLOAD_FOLDERS,
  type AdminCategory,
  type AdminCategoryNode,
  type AdminImageUrls,
  type AdminOrder,
  type AdminOrderAddress,
  type AdminOrderCustomer,
  type AdminOrderFulfillment,
  type AdminOrderItem,
  type AdminOrderPayment,
  type AdminOrderSummary,
  type AdminOrderTotals,
  type AdminPage,
  type AdminProduct,
  type AdminVariant,
  type AdminVariantInput,
  type CreateProductInput,
  type FulfillmentMode,
  type OrderStatus,
  type PaymentMethod,
  type ProductStatusFilter,
  type UpdateProductInput,
  type UploadFolder,
  type UploadSignature,
  type UploadedImage,
} from './admin.types';

export {
  ADMIN_AREAS,
  ROLE_LABELS,
  areasFor,
  canHandleOrders,
  canManageStore,
  canManageSystem,
  canSee,
  canSeePrices,
  type AdminArea,
} from './admin.roles';

export {
  changePassword,
  fetchMe,
  login,
  logout,
  type ChangePasswordInput,
  type LoginInput,
} from './admin-auth.api';

export {
  LOW_STOCK_THRESHOLD,
  countSince,
  lowStock,
  outOfStock,
  revenueOf,
  startOfMonth,
  startOfToday,
  type LowStockLine,
  type Revenue,
} from './dashboard';

export {
  useAdminLogin,
  useAdminRole,
  useAdminSignOut,
  useAdminUser,
  useChangePassword,
  useIsSignedIn,
  useMustChangePassword,
} from './use-admin-auth';

export { useDashboard, type Dashboard } from './use-dashboard';

export {
  FULFILLMENT_LABELS,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_LABELS,
  paymentLabel,
  statusTone,
  whatsappLink,
} from './order-labels';

export {
  EMPTY_ORDER_FILTERS,
  activeFilterCount,
  orderFiltersToSearch,
  orderListParams,
  readOrderFilters,
  withFilter,
  type OrderFilters,
} from './order-filters';

export { useOrder, useOrders, useSetOrderNotes, useSetOrderStatus } from './use-orders';

export {
  EMPTY_PRODUCT_FILTERS,
  activeProductFilterCount,
  productFiltersToSearch,
  productListParams,
  readProductFilters,
  withProductFilter,
  type ProductFilters,
} from './product-filters';

export {
  draftFromProduct,
  draftToCreate,
  draftToUpdate,
  duplicateVariant,
  emptyProductDraft,
  hasErrors,
  moveImage,
  newVariant,
  removeImage,
  setCover,
  validateDraft,
  type DraftErrors,
  type ProductDraft,
  type VariantDraft,
} from './product-form';

export {
  useAdminCategories,
  useDeleteProduct,
  useProduct,
  useProducts,
  useSaveProduct,
  useSetProductStatus,
} from './use-products';

export { useImageUpload, type ImageUpload, type UploadProgress } from './use-image-upload';

export {
  AUDIT_ACTION_OPTIONS,
  describeAction,
  describeField,
  describeValue,
  diffOf,
  isSensitive,
  type DiffLine,
} from './audit-diff';

export {
  createUser,
  fetchHealth,
  listAudit,
  listCollections,
  listUsers,
  resetUserPassword,
  revokeSessions,
  runDemoSeed,
  setUserStatus,
  updateUser,
} from './system.api';

export {
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  type AuditAction,
  type AuditEntry,
  type AuditListParams,
  type AuditTargetKind,
  type CollectionCount,
  type CreateUserInput,
  type DatabaseStatus,
  type FieldChange,
  type HealthStatus,
  type PasswordResetResult,
  type SeedResult,
  type SystemUser,
  type UpdateUserInput,
} from './system.types';

export {
  TEMPORARY_PASSWORD_LENGTH,
  copyToClipboard,
  generateTemporaryPassword,
} from './temporary-password';

export {
  isMissingRoute,
  useAudit,
  useCollections,
  useCreateUser,
  useDemoSeed,
  useHealth,
  useResetPassword,
  useRevokeSessions,
  useSetUserStatus,
  useUpdateUser,
  useUsers,
} from './use-system';
