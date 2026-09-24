/**
 * Os componentes que sabem o que e a loja.
 *
 * Conhecem produto, sacola, categoria e as configurações da loja — e não
 * aparecem no painel. O que serve aos dois lados desce para `components/ui`.
 */

export { AnnouncementBar } from './announcement-bar';
export { BrandLogo } from './brand-logo';
export { CartButton } from './cart-button';
export { CartDrawer } from './cart-drawer';
export { CartEmpty } from './cart-empty';
export { CartLineRow, type CartLineRowProps } from './cart-line-row';
export { CartNotices, type CartNoticesProps } from './cart-notices';
export { CategoriesPanel } from './categories-panel';
export { MainNav } from './main-nav';
export { MessageScreen } from './message-screen';
export { MobileMenu } from './mobile-menu';
/**
 * `NewsletterForm` não e reexportado aqui, e a ausência e proposital.
 *
 * Uma reexportação estática neste barril torna o módulo alcancável a partir
 * do layout da loja — que importa daqui — e o Rollup o empacota no pedaço
 * inicial junto com `zod` e `react-hook-form`. O `lazy` de
 * `DeferredNewsletter` continuaria compilando e o formulário continuaria
 * funcionando: o único sintoma seria o pedaço inicial treze kilobytes mais
 * gordo, que ninguém percebe numa revisão. Quem precisar do formulário
 * sincrono importa de './newsletter-form'.
 */
export { DeferredNewsletter } from './deferred-newsletter';
export { Highlight, type HighlightProps } from './highlight';

/**
 * Os ícones, para as telas que os desenham fora desta pasta.
 *
 * Não pesam no pedaço inicial: o cabeçalho e o rodapé já importam metade
 * deles, e cada um e um punhado de `<path>` sem dependência nenhuma.
 */
export {
  BoxIcon,
  CardIcon,
  CartIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  ExitIcon,
  EyeIcon,
  EyeOffIcon,
  InstagramIcon,
  MenuIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  ShieldIcon,
  StarIcon,
  TiktokIcon,
  TrashIcon,
  TruckIcon,
  UserIcon,
  WhatsappIcon,
} from './icons';
export { ProductCard, type ProductCardProps } from './product-card';
export { ProductCardSkeleton } from './product-card-skeleton';
export { ProductGrid, type ProductGridProps } from './product-grid';
export { ProductShelf, shelfWillRender, type ShelfContent } from './product-shelf';
export { SearchOverlay } from './search-overlay';
export { SectionHeading } from './section-heading';
export { StoreFooter } from './store-footer';
export { StoreHeader } from './store-header';
export { TrustBadges } from './trust-badges';
export { VariantPicker } from './variant-picker';
export { WhatsappButton } from './whatsapp-button';

export { useAddToCart } from './use-add-to-cart';
export { useRecentSearches } from './use-recent-searches';
export { useScrolled } from './use-scrolled';
