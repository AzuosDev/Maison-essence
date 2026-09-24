import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  AlertIcon,
  BottleIcon,
  CardIcon,
  OrdersTable,
  ReceiptIcon,
  StatCard,
} from '@/components/admin';
import {
  ORDER_STATUSES,
  canSee,
  canSeePrices,
  useAdminRole,
  useAdminUser,
  useDashboard,
} from '@/features/admin';
import { formatCents } from '@/lib/format';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-home-page.module.css';

/**
 * A abertura do painel.
 *
 * Responde, na ordem, as perguntas de quem acabou de abrir a loja: **o que
 * chegou**, **o que esta me esperando**, **como vai o mês**, **o que esta
 * faltando**. Os quatro números levam a lista que os explica, a lista dos
 * últimos dez pedidos vem logo abaixo, e o aviso de estoque fecha a tela.
 *
 * ## O que o STAFF vê
 *
 * Dois dos quatro cards. Faturamento do mês e produtos esgotados pertencem a
 * quem administra o catálogo; a lista de pedidos aparece sem a coluna de
 * total. Não e a tela escondendo por precaução — e o mesmo recorte que o
 * backend aplica, e que faz o papel existir.
 *
 * ## De onde vem o faturamento
 *
 * Não há rota de metricas na API. Os números são somados aqui, a partir das
 * listagens — `features/admin/dashboard.ts` explica a conta e o limite dela.
 * Quando a soma parar na primeira página, o card diz que o valor e um piso,
 * em vez de mostrar um total que não e total.
 */
export default function AdminHomePage() {
  const role = useAdminRole();
  const user = useAdminUser();
  const dashboard = useDashboard();

  usePageMeta({ title: 'Painel — Maison Essence', description: 'Acesso restrito.' });

  const showMoney = canSeePrices(role);
  const showCatalog = canSee(role, 'products');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{welcome(user?.name)}</h1>
        <p className={styles.subtitle}>O resumo de hoje e o que precisa de você.</p>
      </header>

      <div className={styles.cards}>
        <StatCard
          label="Pedidos de hoje"
          value={String(dashboard.todayCount)}
          note={dashboard.todayCount === 0 ? 'Nenhum pedido ainda hoje.' : 'Desde a meia-noite.'}
          to={ROUTES.admin.orders}
          icon={ReceiptIcon}
          isLoading={dashboard.isLoading}
        />

        <StatCard
          label="Esperando contato"
          value={String(dashboard.pendingCount)}
          note={
            dashboard.pendingCount === 0
              ? 'Tudo respondido.'
              : 'Abra a conversa antes que o cliente desista.'
          }
          to={`${ROUTES.admin.orders}?status=${ORDER_STATUSES.PENDING_CONTACT}`}
          icon={AlertIcon}
          alert={dashboard.pendingCount > 0}
          isLoading={dashboard.isLoading}
        />

        {showMoney ? (
          <StatCard
            label="Faturamento do mês"
            value={formatCents(dashboard.monthRevenue.cents)}
            note={
              dashboard.monthRevenue.truncated
                ? 'No mínimo: há mais pedidos do que coube na soma.'
                : 'Pedidos confirmados em diante.'
            }
            to={ROUTES.admin.orders}
            icon={CardIcon}
            isLoading={dashboard.isLoading}
          />
        ) : null}

        {showCatalog ? (
          <StatCard
            label="Sem estoque"
            value={String(dashboard.outOfStockCount)}
            note={
              dashboard.outOfStockCount === 0
                ? 'Nenhum produto esgotado.'
                : 'Publicados e sem unidade a venda.'
            }
            to={ROUTES.admin.products}
            icon={BottleIcon}
            alert={dashboard.outOfStockCount > 0}
            isLoading={dashboard.isLoading}
          />
        ) : null}
      </div>

      <section className={styles.block} aria-labelledby="recent-orders">
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle} id="recent-orders">
            Últimos pedidos
          </h2>

          <Link to={ROUTES.admin.orders} className={styles.blockLink}>
            Ver todos
          </Link>
        </div>

        <OrdersTable
          orders={dashboard.recentOrders}
          isLoading={dashboard.isLoading}
          showTotals={showMoney}
          showPayment={false}
          emptyTitle="Nenhum pedido ainda"
          emptyDescription="Os pedidos feitos pelo site aparecem aqui, do mais novo para o mais antigo."
        />
      </section>

      {showCatalog && dashboard.lowStock.length > 0 ? (
        <section className={styles.block} aria-labelledby="low-stock">
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle} id="low-stock">
              Estoque acabando
            </h2>
          </div>

          {/*
            Por variante, e nao por produto: "Asad esta acabando" nao diz o
            que comprar. O que resolve e saber que restam duas unidades do de
            100ml.
          */}
          <ul className={styles.stockList}>
            {dashboard.lowStock.map(({ product, variant }) => (
              <li key={variant.id} className={styles.stockItem}>
                <Link to={ROUTES.admin.product(product.id)} className={styles.stockName}>
                  {product.name}
                  {variant.label === '' ? '' : ` · ${variant.label}`}
                </Link>

                <span className={styles.stockCount}>
                  {variant.stock === 1 ? 'última unidade' : `${String(variant.stock)} unidades`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** "Bom dia" até as 12, "Boa tarde" até as 18, "Boa noite" depois. */
function greeting(now: Date = new Date()): string {
  const hour = now.getHours();

  if (hour < 12) {
    return 'Bom dia';
  }

  return hour < 18 ? 'Boa tarde' : 'Boa noite';
}

/**
 * "Bom dia, Rayane".
 *
 * Só o primeiro nome, que e como a dona assina e como a equipe se chama. Sem
 * nome — a sessão guardada não tem o usuário, só os tokens — fica só a
 * saudação: "Bom dia," com a vírgula orfa e pior do que "Bom dia".
 */
function welcome(name: string | undefined): string {
  const first = name === undefined ? '' : (name.trim().split(' ')[0] ?? '');

  return first === '' ? greeting() : `${greeting()}, ${first}`;
}
