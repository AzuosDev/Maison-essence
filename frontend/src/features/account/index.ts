/**
 * A área do cliente.
 *
 * Importe daqui — `import { useMyOrders } from '@/features/account'` — e
 * nunca dos arquivos internos, com uma exceção: `account-session` e
 * carregado pelo módulo de providers antes de qualquer tela existir, e passa
 * direto para não arrastar o resto da área para o pedaço inicial do bundle.
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

export { maskIdentifier, resolveIdentifier, type SignInIdentity } from './sign-in-identifier';

export {
  addressSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  newPasswordSchema,
  profileSchema,
  registerSchema,
  signInSchema,
  type AddressForm,
  type ChangePasswordForm,
  type ForgotPasswordForm,
  type NewPasswordForm,
  type ProfileForm,
  type RegisterForm,
  type SignInForm,
} from './account.schema';

export {
  MAX_ADDRESSES,
  ORDERS_PAGE_SIZE,
  PASSWORD_MIN_LENGTH,
  type AccountAddress,
  type AddressInput,
  type ChangePasswordInput,
  type CustomerOrderDetail,
  type CustomerOrderSummary,
  type ForgotPasswordInput,
  type LoginInput,
  type Paginated,
  type RegisterInput,
  type ResetPasswordInput,
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
  useChangePassword,
  useCustomer,
  useCustomerLogin,
  useCustomerRegister,
  useForgotPassword,
  useIsSignedIn,
  useMyOrder,
  useMyOrders,
  useProfile,
  useResetPassword,
  useSaveAddresses,
  useSignOut,
  useUpdateProfile,
} from './use-account';

export { useReorder } from './use-reorder';
