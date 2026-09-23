export {
  fetchAdminProduct,
  fetchOrder,
  listOrders,
  listProducts,
  updateOrderNotes,
  updateOrderStatus,
  updateProductStatus,
} from './admin.api';

export { adminKeys, type AdminOrderListParams, type AdminProductListParams } from './admin.keys';

export {
  ADMIN_MAX_PAGE_SIZE,
  ADMIN_PAGE_SIZE,
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  SOLD_ORDER_STATUSES,
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
  type FulfillmentMode,
  type OrderStatus,
  type PaymentMethod,
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
