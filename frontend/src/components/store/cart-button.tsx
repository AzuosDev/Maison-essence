import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { cartItemCount, useCart } from '@/features/cart';
import { cx } from '@/lib/cx';
import { CartIcon } from './icons';
import styles from './icon-button.module.css';

/**
 * A sacola do cabeçalho, com o contador.
 *
 * O número sai do store do carrinho por um seletor, e não do estado inteiro:
 * `useCart(cartItemCount)` só faz este botão renderizar quando a *contagem*
 * muda. Trocar a quantidade de uma linha de 2 para 3 redesenha o contador;
 * mexer em qualquer outro campo da sacola, não.
 *
 * O rótulo acessível carrega a contagem por extenso porque o número
 * desenhado no canto do ícone e pequeno demais para ser o único aviso — e,
 * para quem ouve a página, ele não existe.
 *
 * ## A batida ao crescer
 *
 * Quando a contagem sobe, o contador da um pulo curto. E o único movimento
 * do cabeçalho desta loja, e ele existe por um motivo específico: o clique
 * em "adicionar" acontece no meio da página, e o efeito dele aparece no
 * canto superior direito — longe de onde o olho estava. A batida e o que
 * liga uma coisa a outra.
 *
 * Só **ao crescer**: remover um item não merece comemoração, e um contador
 * que pula ao diminuir parece erro. E só quando já havia um número antes —
 * o primeiro item da visita já chama atenção sozinho, porque o contador
 * aparece do nada.
 *
 * A animação se remove sozinha ao terminar (`onAnimationEnd`), e não por
 * temporizador: e o próprio navegador dizendo que acabou, inclusive para
 * quem pediu menos movimento — nesse caso ela dura 0,01ms por causa do
 * `prefers-reduced-motion` global, termina de imediato e nunca chega a ser
 * vista.
 */
export function CartButton() {
  const count = useCart(cartItemCount);
  const [bumping, setBumping] = useState(false);

  // A contagem anterior num ref: ela não desenha nada por si, e guarda-lá em
  // estado daria um render a mais a cada mudanca da sacola.
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current && previous.current > 0) {
      setBumping(true);
    }

    previous.current = count;
  }, [count]);

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
        <span
          className={cx(styles.counter, bumping && styles.bump)}
          aria-hidden="true"
          onAnimationEnd={() => {
            setBumping(false);
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
