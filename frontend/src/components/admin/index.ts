/**
 * Os componentes que sabem o que e o painel.
 *
 * Conhecem papel, pedido, produto do ponto de vista de quem opera — e nao
 * aparecem na loja. O que serve aos dois lados desce para `components/ui`.
 */

export {
  AlertIcon,
  BottleIcon,
  CardIcon,
  ChatIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  GripIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  MenuIcon,
  MoreIcon,
  PinIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SignOutIcon,
  SlidersIcon,
  TrashIcon,
  TruckIcon,
} from './admin-icons';

export { AdminNav, type AdminNavProps } from './admin-nav';
export { OrdersTable, type OrdersTableProps } from './orders-table';
export { StatCard, type StatCardProps } from './stat-card';
