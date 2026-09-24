import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { BoxIcon, ExitIcon, PinIcon, UserIcon } from '@/components/store';
import { useSignOut } from '@/features/account';
import { cx } from '@/lib/cx';
import styles from './account-nav.module.css';

/**
 * O menu da conta: tres telas e a saida.
 *
 * ## A ordem nao e alfabetica
 *
 * Pedidos vem primeiro porque e o unico motivo pelo qual alguem abre esta
 * area — as outras duas telas existem para servir a compra seguinte.
 * Enderecos vem depois, dados de contato por ultimo: e a ordem da frequencia
 * com que cada uma e aberta, que e a ordem em que se procura.
 *
 * ## O mesmo menu em duas formas
 *
 * No celular e uma fila horizontal que rola, logo abaixo do cabecalho: tres
 * itens empilhados verticalmente antes do conteudo empurrariam a lista de
 * pedidos para fora da primeira tela, e o pedido e o que a pessoa veio ver.
 * A partir de 1024px vira a coluna lateral, que e o formato que o layout ja
 * reserva.
 *
 * `end` no item de pedidos e o detalhe que evita o erro classico: sem ele,
 * `/conta/pedidos` ficaria marcado como ativo tambem em
 * `/conta/pedidos/ME-260922-4KP1`. Aqui isso e desejavel — o detalhe **e**
 * parte de pedidos —, entao `end` fica so no perfil, cuja rota e o prefixo
 * de todas as outras.
 */
export function AccountNav() {
  const signOut = useSignOut();

  return (
    <nav className={styles.nav} aria-label="Áreas da conta">
      <ul className={styles.list}>
        <li>
          <NavLink to={ROUTES.account.orders} className={itemClass}>
            <BoxIcon className={styles.icon} />
            Meus pedidos
          </NavLink>
        </li>

        <li>
          <NavLink to={ROUTES.account.addresses} className={itemClass}>
            <PinIcon className={styles.icon} />
            Endereços
          </NavLink>
        </li>

        <li>
          <NavLink to={ROUTES.account.profile} end className={itemClass}>
            <UserIcon className={styles.icon} />
            Meus dados
          </NavLink>
        </li>
      </ul>

      <button type="button" className={styles.signOut} onClick={signOut}>
        <ExitIcon className={styles.icon} />
        Sair da conta
      </button>
    </nav>
  );
}

function itemClass({ isActive }: { isActive: boolean }): string {
  return cx(styles.item, isActive && styles.active);
}
