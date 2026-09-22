export {
  fetchAdminProduct,
  fetchOrder,
  listOrders,
  listProducts,
  updateOrderNotes,
  updateOrderStatus,
  updateProductStatus,
} from './admin.api';

export {
  adminKeys,
  type AdminOrderListParams,
  type AdminProductListParams,
} from './admin.keys';

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
  PAYMENT_LABELS,
  statusTone,
  whatsappLink,
} from './order-labels';
