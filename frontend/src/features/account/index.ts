/**
 * A area do cliente.
 *
 * Importe daqui — `import { useMyOrders } from '@/features/account'` — e
 * nunca dos arquivos internos, com uma excecao: `account-session` e
 * carregado pelo modulo de providers antes de qualquer tela existir, e passa
 * direto para nao arrastar o resto da area para o pedaco inicial do bundle.
 */

export {
  fetchMyOrder,
  fetchProfile,
  listMyOrders,
  loginCustomer,
  registerCustomer,
  updateProfile,
} from './account.api';

export { accountKeys } from './account.keys';

export { addAddress, editAddress, makeDefault, removeAddress, toInputs } from './address-list';

export { conversationUrl } from './conversation';

export {
  addressSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  type AddressForm,
  type LoginForm,
  type ProfileForm,
  type RegisterForm,
} from './account.schema';

export {
  MAX_ADDRESSES,
  ORDERS_PAGE_SIZE,
  PASSWORD_MIN_LENGTH,
  type AccountAddress,
  type AddressInput,
  type CustomerOrderDetail,
  type CustomerOrderSummary,
  type LoginInput,
  type Paginated,
  type RegisterInput,
  type UpdateProfileInput,
} from './account.types';

export {
  ORDER_FLOW,
  orderTimeline,
  statusLabel,
  statusTone,
  type TimelineStep,
} from './order-status';

export {
  isEmptyPlan,
  planReorder,
  reorderItems,
  type DroppedItem,
  type ReorderLine,
  type ReorderPlan,
} from './reorder';

export {
  useCustomer,
  useCustomerLogin,
  useCustomerRegister,
  useIsSignedIn,
  useMyOrder,
  useMyOrders,
  useProfile,
  useSaveAddresses,
  useSignOut,
  useUpdateProfile,
} from './use-account';

export { useReorder } from './use-reorder';
