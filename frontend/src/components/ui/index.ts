/**
 * Os primitivos do design system.
 *
 * O que entra aqui nao sabe nada sobre a loja nem sobre o painel: um botao
 * nao conhece produto, e um container nao conhece pedido. O que conhece mora
 * em `components/store` e `components/admin`.
 */

export {
  Button,
  ButtonLink,
  type ButtonLinkProps,
  type ButtonProps,
  type ButtonVariant,
} from './button';
export { Container } from './container';
export { Spinner } from './spinner';
