import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { BoxIcon, ExitIcon, PinIcon, UserIcon } from '@/components/store';
import { useSignOut } from '@/features/account';
import { cx } from '@/lib/cx';
import styles from './account-nav.module.css';

/**
 * O menu da conta: três telas e a saída.
 *
 * ## A ordem não e alfabética
 *
 * Pedidos vem primeiro porque e o único motivo pelo qual alguém abre esta
 * área — as outras duas telas existem para servir a compra seguinte.
 * Endereços vem depois, dados de contato por último: e a ordem da frequência
 * com que cada uma e aberta, que e a ordem em que se procura.
 *
 * ## O mesmo menu em duas formas
 *
 * No celular e uma fila horizontal que rola, logo abaixo do cabeçalho: três
 * itens empilhados verticalmente antes do conteúdo empurrariam a lista de
 * pedidos para fora da primeira tela, e o pedido e o que a pessoa veio ver.
 * A partir de 1024px vira a coluna lateral, que e o formato que o layout já
 * reserva.
 *
 * `end` no item de pedidos e o detalhe que evita o erro clássico: sem ele,
 * `/conta/pedidos` ficaria marcado como ativo também em
 * `/conta/pedidos/ME-260922-4KP1`. Aqui isso e desejável — o detalhe **e**
 * parte de pedidos —, então `end` fica só no perfil, cuja rota e o prefixo
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
