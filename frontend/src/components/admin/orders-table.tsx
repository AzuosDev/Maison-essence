import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Badge, EmptyState, Skeleton } from '@/components/ui';
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  paymentLabel,
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
 * ## Por que não e uma tabela que vira card por CSS
 *
 * O truque conhecido — `display: block` nas células e o rótulo no
 * `::before` — mantem um DOM só, e e por isso que ele e tentador. O preço e
 * que a tabela continua anunciada como tabela para quem usa leitor de tela,
 * com células que não tem mais linha nem coluna, e o rótulo de cada campo
 * vira conteúdo de CSS, que não e lido. A dona usa o painel no celular na
 * maior parte do tempo: e o formato do celular que precisa estar certo.
 *
 * Aqui são duas árvores, e uma só e montada — `useMediaQuery` decide qual.
 * No desktop, uma `<table>` de verdade, com cabeçalho e escopo de coluna. No
 * celular, uma lista de cards, cada um com o rótulo escrito ao lado do
 * valor.
 *
 * ## O telefone e um link
 *
 * E o atalho mais usado do painel: a dona vê o pedido e responde na
 * conversa. O link abre o WhatsApp com o número já preenchido — e fica fora
 * do link do pedido, porque são dois destinos diferentes no mesmo card.
 */

/** Acima disto, tabela. Abaixo, cards — o corte que o painel usa inteiro. */
const WIDE = '(min-width: 48rem)';

export interface OrdersTableProps {
  orders: readonly AdminOrderSummary[];
  isLoading?: boolean;
  /** Esconde as colunas de dinheiro. O STAFF não vê valor. */
  showTotals?: boolean;
  /**
   * Mostra como o pedido foi pago.
   *
   * Ligado na tela de pedidos, onde a dona esta decidindo o que responder, e
   * desligado na abertura do painel, que e uma olhada de relance: uma coluna
   * a mais ali empurra o código e o cliente para fora da largura do celular
   * sem responder nenhuma pergunta que a abertura faca.
   *
   * Não segue `showTotals`: "Cartão 6x" diz como o cliente vai pagar, e não
   * quanto a loja ganha. O STAFF precisa disso para atender.
   */
  showPayment?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function OrdersTable({
  orders,
  isLoading = false,
  showTotals = true,
  showPayment = true,
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
    <OrderRows orders={orders} showTotals={showTotals} showPayment={showPayment} />
  ) : (
    <OrderCards orders={orders} showTotals={showTotals} showPayment={showPayment} />
  );
}

/* ---- Desktop ------------------------------------------------------------ */

function OrderRows({
  orders,
  showTotals,
  showPayment,
}: {
  orders: readonly AdminOrderSummary[];
  showTotals: boolean;
  showPayment: boolean;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Cliente</th>
            <th scope="col">Entrega</th>
            {showPayment ? <th scope="col">Pagamento</th> : null}
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

              {showPayment ? (
                <td className={styles.payment}>{paymentLabel(order.payment)}</td>
              ) : null}

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
  showPayment,
}: {
  orders: readonly AdminOrderSummary[];
  showTotals: boolean;
  showPayment: boolean;
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

            {showPayment ? (
              <div>
                <dt>Pagamento</dt>
                <dd>{paymentLabel(order.payment)}</dd>
              </div>
            ) : null}

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
 * Cinco linhas no desktop e três cards no celular, nas alturas de verdade:
 * quando a resposta chega, a tela não salta.
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
