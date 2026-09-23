/**
 * Os componentes que sabem o que e o painel.
 *
 * Conhecem papel, pedido, produto do ponto de vista de quem opera — e nao
 * aparecem na loja. O que serve aos dois lados desce para `components/ui`.
 */

export {
  AlertIcon,
  ArrowLeftIcon,
  BanIcon,
  BottleIcon,
  CardIcon,
  ChatIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  GripIcon,
  HistoryIcon,
  HomeIcon,
  ImageIcon,
  KeyIcon,
  LayersIcon,
  MenuIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  PowerIcon,
  PulseIcon,
  ReceiptIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SignOutIcon,
  SlidersIcon,
  TrashIcon,
  TruckIcon,
  UsersIcon,
} from './admin-icons';

export { AdminNav, type AdminNavProps } from './admin-nav';
export { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';
export { MissingRoute, type MissingRouteProps } from './missing-route';
export { OneTimeSecret, type OneTimeSecretProps } from './one-time-secret';
export { OrderItems, type OrderItemsProps } from './order-items';
export { OrdersTable, type OrdersTableProps } from './orders-table';
export { StatCard, type StatCardProps } from './stat-card';
export { UserActions, type UserActionsProps } from './user-actions';
export { UsersTable, type UsersTableProps } from './users-table';
