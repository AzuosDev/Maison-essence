/**
 * Os componentes que sabem o que e o painel.
 *
 * Conhecem papel, pedido, produto do ponto de vista de quem opera — e não
 * aparecem na loja. O que serve aos dois lados desce para `components/ui`.
 */

export { RateTable, type RateTableProps } from './rate-table';

export {
  AlertIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
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
  StarIcon,
  TagIcon,
  TrashIcon,
  TruckIcon,
  UploadIcon,
  UsersIcon,
} from './admin-icons';

export { AdminNav, type AdminNavProps } from './admin-nav';
export { BannerEditor, type BannerEditorProps } from './banner-editor';
export { BestSellersPicker, type BestSellersPickerProps } from './best-sellers-picker';
export { BrandsPicker, type BrandsPickerProps } from './brands-picker';
export { PosterEditor, type PosterEditorProps } from './poster-editor';
export { ShortcutEditor, type ShortcutEditorProps } from './shortcut-editor';
export {
  LinkTargetFields,
  useCategoryOptions,
  type LinkTargetFieldsProps,
  type SelectOption,
} from './link-target';
export { CategoryPicker, type CategoryPickerProps } from './category-picker';
export { CampaignPreview, type CampaignPreviewProps } from './campaign-preview';
export { CouponCard, type CouponCardProps } from './coupon-card';
export { CategoryTree, type CategoryTreeProps } from './category-tree';
export { DeliveryTable, type DeliveryTableProps } from './delivery-table';
export { GiftEditor, type GiftEditorProps } from './gift-editor';
export { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';
export { ImageManager, type ImageManagerProps } from './image-manager';
export { MissingRoute, type MissingRouteProps } from './missing-route';
export { OneTimeSecret, type OneTimeSecretProps } from './one-time-secret';
export { OrderItems, type OrderItemsProps } from './order-items';
export { PagesEditor, type PagesEditorProps } from './pages-editor';
export { PerfumePicker, type PerfumePickerProps } from './perfume-picker';
export {
  ProductPicker,
  ProductSearch,
  ProductThumb,
  type ProductPickerCopy,
  type ProductPickerProps,
  type ProductSearchProps,
} from './product-picker';
export {
  ProductMultiPicker,
  type ProductMultiPickerProps,
} from './product-multi-picker';
export { RowMenu, type RowMenuItem, type RowMenuProps } from './row-menu';
export { UsesRuler, type UsesRulerProps } from './uses-ruler';
export { PaymentPreview, type PaymentPreviewProps } from './payment-preview';
export { OrdersTable, type OrdersTableProps } from './orders-table';
export { ProductsTable, type ProductsTableProps } from './products-table';
export { StatCard, type StatCardProps } from './stat-card';
export { UserActions, type UserActionsProps } from './user-actions';
export { UsersTable, type UsersTableProps } from './users-table';
export { VariantsEditor, type VariantsEditorProps } from './variants-editor';
