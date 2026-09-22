import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Badge, EmptyState, Skeleton } from '@/components/ui';
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  statusTone,
  whatsappLink,
  type AdminOrderSummary,
} from '@/features/admin';
import { cx } from '@/lib/cx';
import { formatCents, formatDate } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { ChatIcon, ChevronRightIcon } from './admin-icons';
import styles from './orders-table.module.css';

/**
 * A lista de pedidos: tabela no desktop, cards no celular.
 *
 * ## Por que nao e uma tabela que vira card por CSS
 *
 * O truque conhecido — `display: block` nas celulas e o rotulo no
 * `::before` — mantem um DOM so, e e por isso que ele e tentador. O preco e
 * que a tabela continua anunciada como tabela para quem usa leitor de tela,
 * com celulas que nao tem mais linha nem coluna, e o rotulo de cada campo
 * vira conteudo de CSS, que nao e lido. A dona usa o painel no celular na
 * maior parte do tempo: e o formato do celular que precisa estar certo.
 *
 * Aqui sao duas arvores, e uma so e montada — `useMediaQuery` decide qual.
 * No desktop, uma `<table>` de verdade, com cabecalho e escopo de coluna. No
 * celular, uma lista de cards, cada um com o rotulo escrito ao lado do
 * valor.
 *
 * ## O telefone e um link
 *
 * E o atalho mais usado do painel: a dona ve o pedido e responde na
 * conversa. O link abre o WhatsApp com o numero ja preenchido — e fica fora
 * do link do pedido, porque sao dois destinos diferentes no mesmo card.
 */

/** Acima disto, tabela. Abaixo, cards — o corte que o painel usa inteiro. */
const WIDE = '(min-width: 48rem)';

export interface OrdersTableProps {
  orders: readonly AdminOrderSummary[];
  isLoading?: boolean;
  /** Esconde as colunas de dinheiro. O STAFF nao ve valor. */
  showTotals?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function OrdersTable({
  orders,
  isLoading = false,
  showTotals = true,
  emptyTitle = 'Nenhum pedido por aqui',
  emptyDescription = 'Quando um pedido chegar pelo site, ele aparece nesta lista.',
}: OrdersTableProps) {
  const isWide = useMediaQuery(WIDE);

  if (isLoading) {
    return <OrdersSkeleton wide={isWide} />;
  }

  if (orders.length === 0) {
    return <EmptyState as="h3" title={emptyTitle} description={emptyDescription} />;
  }

  return isWide ? (
    <OrderRows orders={orders} showTotals={showTotals} />
  ) : (
    <OrderCards orders={orders} showTotals={showTotals} />
  );
}

/* ---- Desktop ------------------------------------------------------------ */

function OrderRows({
  orders,
  showTotals,
}: {
  orders: readonly AdminOrderSummary[];
  showTotals: boolean;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Codigo</th>
            <th scope="col">Cliente</th>
            <th scope="col">Entrega</th>
            <th scope="col" className={styles.numeric}>
              Itens
            </th>
            {showTotals ? (
              <th scope="col" className={styles.numeric}>
                Total
              </th>
            ) : null}
            <th scope="col">Status</th>
            <th scope="col">
              <span className="visually-hidden">Abrir</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <th scope="row" className={styles.code}>
                <Link to={ROUTES.admin.order(order.id)} className={styles.codeLink}>
                  {order.code}
                </Link>
                <span className={styles.date}>{formatDate(order.createdAt)}</span>
              </th>

              <td>
                <span className={styles.customer}>{order.customerName}</span>
                <a
                  href={whatsappLink(order.phone)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.phone}
                >
                  <ChatIcon className={styles.phoneIcon} />
                  {order.phoneLabel}
                </a>
              </td>

              <td>{FULFILLMENT_LABELS[order.mode]}</td>

              <td className={cx(styles.numeric, 'tabular')}>{order.itemCount}</td>

              {showTotals ? (
                <td className={cx(styles.numeric, 'tabular')}>{formatCents(order.totalCents)}</td>
              ) : null}

              <td>
                <Badge variant={statusTone(order.status)}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </td>

              <td className={styles.open}>
                <Link
                  to={ROUTES.admin.order(order.id)}
                  className={styles.openLink}
                  aria-label={`Abrir o pedido ${order.code}`}
                >
                  <ChevronRightIcon />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Celular ------------------------------------------------------------ */

function OrderCards({
  orders,
  showTotals,
}: {
  orders: readonly AdminOrderSummary[];
  showTotals: boolean;
}) {
  return (
    <ul className={styles.cards}>
      {orders.map((order) => (
        <li key={order.id} className={styles.card}>
          <div className={styles.cardHead}>
            <Link to={ROUTES.admin.order(order.id)} className={styles.cardCode}>
              {order.code}
            </Link>

            <Badge variant={statusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          </div>

          <p className={styles.cardCustomer}>{order.customerName}</p>

          <dl className={styles.cardFacts}>
            <div>
              <dt>Data</dt>
              <dd>{formatDate(order.createdAt)}</dd>
            </div>

            <div>
              <dt>Itens</dt>
              <dd className="tabular">{order.itemCount}</dd>
            </div>

            <div>
              <dt>Entrega</dt>
              <dd>{FULFILLMENT_LABELS[order.mode]}</dd>
            </div>

            {showTotals ? (
              <div>
                <dt>Total</dt>
                <dd className="tabular">{formatCents(order.totalCents)}</dd>
              </div>
            ) : null}
          </dl>

          <a
            href={whatsappLink(order.phone)}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.cardPhone}
          >
            <ChatIcon className={styles.phoneIcon} />
            {order.phoneLabel}
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---- Carregando --------------------------------------------------------- */

/**
 * O esqueleto tem a forma que vai chegar.
 *
 * Cinco linhas no desktop e tres cards no celular, nas alturas de verdade:
 * quando a resposta chega, a tela nao salta.
 */
function OrdersSkeleton({ wide }: { wide: boolean }) {
  const count = wide ? 5 : 3;

  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={wide ? '3.25rem' : '8rem'} />
      ))}
    </div>
  );
}
