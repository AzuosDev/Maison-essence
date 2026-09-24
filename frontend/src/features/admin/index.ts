export {
  createCategory,
  createDeliveryCity,
  createProduct,
  deleteCategory,
  deleteDeliveryCity,
  deleteProduct,
  fetchAdminPaymentSettings,
  fetchAdminSettings,
  fetchAdminProduct,
  fetchOrder,
  listAdminCategories,
  listDeliveryCities,
  listOrders,
  listProducts,
  reorderCategories,
  reorderDeliveryCities,
  updateCategory,
  updateDeliveryCity,
  updateOrderNotes,
  updateOrderStatus,
  updatePaymentSettings,
  updateSettings,
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
  CATEGORY_LIMITS,
  DELIVERY_LIMITS,
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  PAYMENT_LIMITS,
  PAYMENT_METHODS,
  PRODUCT_LIMITS,
  PRODUCT_STATUS_FILTERS,
  SETTINGS_LIMITS,
  SOLD_ORDER_STATUSES,
  UPLOAD_FOLDERS,
  type AdminCategory,
  type AdminCategoryNode,
  type AdminDeliveryCity,
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
  type AdminPaymentSettings,
  type AdminBanner,
  type AdminInstitutionalPage,
  type AdminPickupAddress,
  type AdminProduct,
  type AdminSocialLinks,
  type AdminStoreSettings,
  type AdminVariant,
  type AdminVariantInput,
  type CategoryBlockedDetails,
  type CreateCategoryInput,
  type CreateDeliveryCityInput,
  type CreateProductInput,
  type FulfillmentMode,
  type OrderStatus,
  type PaymentMethod,
  type ProductStatusFilter,
  type UpdateCategoryInput,
  type UpdateDeliveryCityInput,
  type UpdatePaymentSettingsInput,
  type BannerInput,
  type InstitutionalPageInput,
  type UpdateProductInput,
  type UpdateStoreSettingsInput,
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
  useDeleteProduct,
  useProduct,
  useProducts,
  useSaveProduct,
  useSetProductStatus,
  type SaveProductInput,
} from './use-products';

export {
  blockedBy,
  countCategories,
  flatten,
  hasChildren,
  menuOrder,
  moveChild,
  moveParent,
  parentOptions,
} from './category-tree';

export {
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from './use-categories';

export {
  changesOf,
  draftFromCity,
  draftToCreate as cityDraftToCreate,
  emptyCityDraft,
  estimatedLabel,
  hasCityErrors,
  validateCity,
  type CityDraft,
  type CityErrors,
} from './delivery';

export {
  PIX_KEY_LABELS,
  PIX_KEY_MESSAGES,
  PIX_KEY_PLACEHOLDERS,
  changesOf as paymentChangesOf,
  draftFromSettings as draftFromPaymentSettings,
  hasPaymentErrors,
  isDirty as isPaymentDirty,
  normalizePixKey,
  percentFromInput,
  percentToInput,
  pixPreview,
  prettyPixKey,
  previewCard,
  validatePayment,
  warningsOf as paymentWarningsOf,
  type PaymentDraft,
  type PaymentErrors,
  type PaymentWarning,
  type PixPreview,
} from './payment-settings';

export { useAdminPaymentSettings, useSavePaymentSettings } from './use-payment-settings';

export {
  BANNER_STATUS_LABELS,
  PAGE_LABELS,
  WHATSAPP_MESSAGE,
  bannerStatus,
  bannerToInput,
  changesOf as settingsChangesOf,
  draftFromBanner,
  draftFromSettings as draftFromStoreSettings,
  hasSettingsErrors,
  isDirty as isSettingsDirty,
  moveBanner,
  newBanner,
  normalizeWhatsapp,
  prettyWhatsapp,
  validateAddress,
  validateSettings,
  warningsOf as settingsWarningsOf,
  type AddressDraft,
  type AddressErrors,
  type BannerDraft,
  type BannerErrors,
  type BannerStatus,
  type PageDraft,
  type PageErrors,
  type SettingsDraft,
  type SettingsErrors,
  type SettingsWarning,
} from './store-settings';

export { useAdminSettings, useSaveSettings } from './use-store-settings';

export {
  useCreateDeliveryCity,
  useDeleteDeliveryCity,
  useDeliveryCities,
  useReorderDeliveryCities,
  useUpdateDeliveryCity,
} from './use-delivery';

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
