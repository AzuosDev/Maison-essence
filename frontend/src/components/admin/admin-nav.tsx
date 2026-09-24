import type { ComponentType, SVGProps } from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { areasFor, useAdminRole, type AdminArea } from '@/features/admin';
import { cx } from '@/lib/cx';
import {
  BottleIcon,
  CardIcon,
  HomeIcon,
  LayersIcon,
  PinIcon,
  ReceiptIcon,
  ShieldIcon,
  SlidersIcon,
  TruckIcon,
} from './admin-icons';
import styles from './admin-nav.module.css';

/**
 * O menu do painel.
 *
 * Um componente para os dois lugares onde ele aparece — a coluna escura do
 * desktop e a gaveta do celular —, porque são a mesma lista. O que muda e
 * quem o contem.
 *
 * ## O que não aparece
 *
 * O menu desenha apenas o que o papel abre. Um STAFF vê dois itens, e não
 * oito com seis desabilitados: item cinza que não clica e um convite a
 * perguntar "por que não posso?", e a resposta seria uma conversa sobre
 * permissão no meio do expediente. O guarda de rota cobre o endereço
 * digitado a mão, e o backend recusa de todo jeito.
 *
 * ## O item ativo
 *
 * Fundo dourado translucido e um filete dourado a esquerda. O `NavLink` do
 * React Router marca `aria-current="page"` sozinho — a cor conta para quem
 * vê, e o atributo conta para quem ouve.
 */

interface NavItem {
  area: AdminArea;
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Casa só o endereço exato. Vale para a raiz do painel. */
  end?: boolean;
  /** Abre um grupo novo: desenha o filete acima do item. */
  startsGroup?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { area: 'home', label: 'Início', to: ROUTES.admin.root, icon: HomeIcon, end: true },
  { area: 'products', label: 'Produtos', to: ROUTES.admin.products, icon: BottleIcon },
  { area: 'categories', label: 'Categorias', to: ROUTES.admin.categories, icon: LayersIcon },
  { area: 'readyToShip', label: 'Pronta entrega', to: ROUTES.admin.readyToShip, icon: TruckIcon },
  { area: 'orders', label: 'Pedidos', to: ROUTES.admin.orders, icon: ReceiptIcon },
  { area: 'delivery', label: 'Entrega', to: ROUTES.admin.delivery, icon: PinIcon },
  { area: 'payments', label: 'Pagamento', to: ROUTES.admin.payments, icon: CardIcon },
  { area: 'settings', label: 'Configurações', to: ROUTES.admin.settings, icon: SlidersIcon },
  {
    area: 'system',
    label: 'Sistema',
    to: ROUTES.admin.system,
    icon: ShieldIcon,
    startsGroup: true,
  },
];

export interface AdminNavProps {
  /** Fecha a gaveta depois do clique. Sem isso, o celular navega por trás do véu. */
  onNavigate?: (() => void) | undefined;
}

export function AdminNav({ onNavigate }: AdminNavProps) {
  const role = useAdminRole();
  const allowed = new Set(areasFor(role));

  return (
    <nav aria-label="Áreas do painel">
      <ul className={styles.list}>
        {ITEMS.filter((item) => allowed.has(item.area)).map(
          ({ area, label, to, icon: Icon, end, startsGroup }) => (
            <li key={area} className={cx(startsGroup === true && styles.group)}>
              <NavLink
                to={to}
                end={end ?? false}
                onClick={onNavigate}
                className={({ isActive }) => cx(styles.item, isActive && styles.active)}
              >
                <Icon className={styles.icon} />
                {label}
              </NavLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
