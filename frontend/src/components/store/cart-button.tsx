import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { cartItemCount, useCart } from '@/features/cart';
import { CartIcon } from './icons';
import styles from './icon-button.module.css';

/**
 * A sacola do cabecalho, com o contador.
 *
 * O numero sai do store do carrinho por um seletor, e nao do estado inteiro:
 * `useCart(cartItemCount)` so faz este botao renderizar quando a *contagem*
 * muda. Trocar a quantidade de uma linha de 2 para 3 redesenha o contador;
 * mexer em qualquer outro campo da sacola, nao.
 *
 * O rotulo acessivel carrega a contagem por extenso porque o numero
 * desenhado no canto do icone e pequeno demais para ser o unico aviso — e,
 * para quem ouve a pagina, ele nao existe.
 */
export function CartButton() {
  const count = useCart(cartItemCount);

  return (
    <Link
      to={ROUTES.cart}
      className={styles.button}
      aria-label={
        count === 0 ? 'Sacola vazia' : `Sacola com ${count} ${count === 1 ? 'item' : 'itens'}`
      }
    >
      <CartIcon />

      {count > 0 ? (
        <span className={styles.counter} aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
