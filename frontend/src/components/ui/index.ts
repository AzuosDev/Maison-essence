/**
 * Os primitivos do design system.
 *
 * O que entra aqui não sabe nada sobre a loja nem sobre o painel: um botão
 * não conhece produto, e um cartão não conhece pedido. O que conhece mora em
 * `components/store` e `components/admin`.
 *
 * Três regras valem para todos, sem exceção:
 *
 * 1. **Encaminham `ref`.** Focar um campo depois de um erro, medir um
 *    elemento, rolar até ele — tudo isso precisa do no do DOM.
 * 2. **Aceitam `className`.** O primitivo decide a aparência; quem usa
 *    decide a posição e a largura no layout.
 * 3. **Herdam os tipos do elemento nativo.** `ComponentPropsWithoutRef` faz
 *    `autoComplete`, `maxLength` e `aria-*` funcionarem sem que nenhum deles
 *    precise ser redeclarado — e sem que um deles fique de fora por
 *    esquecimento.
 *
 * Cor, espaço, raio e duração saem sempre de `styles/tokens.css`. Nenhum
 * módulo daqui escreve um hexadecimal.
 */

export {
  Accordion,
  AccordionItem,
  type AccordionItemProps,
  type AccordionProps,
} from './accordion';

export { Badge, type BadgeProps, type BadgeVariant } from './badge';

export {
  Button,
  ButtonLink,
  type ButtonLinkProps,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './button';

export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from './breadcrumb';

export {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  type CardBodyProps,
  type CardFooterProps,
  type CardHeaderProps,
  type CardProps,
} from './card';

export { Checkbox, type CheckboxProps } from './checkbox';

export { Chip, ChipLink, type ChipLinkProps, type ChipProps } from './chip';

export { Container } from './container';

export { Drawer, type DrawerProps } from './drawer';

export { EmptyState, type EmptyStateProps } from './empty-state';

export { Input, type InputProps } from './input';

export { Modal, type ModalProps } from './modal';

export { Pagination, type PaginationProps } from './pagination';

export { QuantityStepper, type QuantityStepperProps } from './quantity-stepper';

export { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from './radio';

export { Select, type SelectOption, type SelectProps } from './select';

export {
  Skeleton,
  SkeletonText,
  type SkeletonProps,
  type SkeletonTextProps,
  type SkeletonVariant,
} from './skeleton';

export { Spinner, type SpinnerProps } from './spinner';

export { Switch, type SwitchProps } from './switch';

export {
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type TabListProps,
  type TabPanelProps,
  type TabProps,
  type TabsProps,
} from './tabs';

export { Textarea, type TextareaProps } from './textarea';

export {
  Toast,
  ToastProvider,
  useToast,
  type ToastAction,
  type ToastOptions,
  type ToastProps,
  type ToastVariant,
} from './toast';
