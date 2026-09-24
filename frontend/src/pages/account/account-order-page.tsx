import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AccountInvite, OrderItems, OrderTimeline, ReorderNotice } from '@/components/account';
import { RepeatIcon, TruckIcon, WhatsappIcon } from '@/components/store';
import { Badge, Button, ButtonLink, Skeleton } from '@/components/ui';
import {
  conversationUrl,
  statusLabel,
  statusTone,
  useIsSignedIn,
  useMyOrder,
  useReorder,
  type CustomerOrderDetail,
} from '@/features/account';
import { useStoreSettings } from '@/features/settings';
import { addressLines, formatCents, formatDateTime, toDateTimeAttribute } from '@/lib/format';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-order-page.module.css';

/**
 * `/conta/pedidos/:code`: o pedido inteiro.
 *
 * ## O que esta tela e
 *
 * Um comprovante que continua valendo meses depois. Todos os numeros aqui
 * sao os que o servidor congelou quando o pedido fechou — preco unitario,
 * desconto, frete, total. Nenhum e recalculado, e essa e a unica maneira de
 * a tela concordar com o que foi cobrado mesmo depois de a loja reajustar
 * tudo.
 *
 * ## Pedir novamente nao copia o passado
 *
 * O botao pergunta ao catalogo de hoje o que ainda existe, poe na sacola o
 * que da e escreve na tela o que nao da. Ver `useReorder` e `planReorder`: a
 * parte dificil e que "nao da" tem dois significados — saiu de linha e
 * sobrou menos —, e eles pedem reacoes diferentes de quem esta comprando.
 *
 * ## O 404 nao e um erro de sistema
 *
 * O backend responde `404` — e nao `403` — para um pedido que existe mas e
 * de outra conta: dizer "existe, mas nao e seu" ja contaria demais sobre um
 * codigo curto o bastante para se tentar adivinhar. A tela le esse `404` do
 * jeito certo para quem esta na frente dela: o pedido nao esta nesta conta,
 * e o motivo provavel e o telefone.
 */
export default function AccountOrderPage() {
  const { code = '' } = useParams<{ code: string }>();
  const signedIn = useIsSignedIn();
  const { data: order, isLoading, isError, error } = useMyOrder(code);
  const { settings } = useStoreSettings();
  const { reorder, plan, dismiss, isPending } = useReorder();

  usePageMeta({
    title: `Pedido ${code} — Maison Essence`,
    description: 'Os detalhes do seu pedido.',
    robots: 'noindex',
  });

  if (!signedIn) {
    return (
      <AccountInvite
        title="Este pedido esta na sua conta"
        description={`Entre para ver os itens, os valores e o andamento do pedido ${code}.`}
      />
    );
  }

  if (isError) {
    return <OrderNotHere code={code} error={error} />;
  }

  if (isLoading || order === undefined) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton height="4rem" />
        <Skeleton height="16rem" />
        <Skeleton height="12rem" />
      </div>
    );
  }

  const conversation = conversationUrl(settings?.whatsappNumber ?? '', order.code);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <Link to={ROUTES.account.orders} className={styles.back}>
          Meus pedidos
        </Link>

        <div className={styles.headLine}>
          <h1 className={styles.code}>{order.code}</h1>
          <Badge variant={statusTone(order.status)}>
            {statusLabel(order.status, order.fulfillment.mode)}
          </Badge>
        </div>

        <p className={styles.placed}>
          Feito em{' '}
          <time dateTime={toDateTimeAttribute(order.createdAt)}>
            {formatDateTime(order.createdAt)}
          </time>
        </p>

        <div className={styles.actions}>
          <Button
            type="button"
            loading={isPending}
            loadingLabel="Conferindo o catalogo"
            onClick={() => {
              reorder(order.items);
            }}
          >
            <RepeatIcon />
            Pedir novamente
          </Button>

          {conversation === '' ? null : (
            <a
              href={conversation}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsapp}
            >
              <WhatsappIcon className={styles.whatsappIcon} />
              Falar sobre este pedido
              <span className="visually-hidden">no WhatsApp, em uma nova aba</span>
            </a>
          )}
        </div>
      </header>

      {plan === null ? null : <ReorderNotice plan={plan} onDismiss={dismiss} />}

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={styles.block} aria-labelledby="order-items-title">
            <h2 id="order-items-title" className={styles.blockTitle}>
              Itens
            </h2>

            <OrderItems items={order.items} />

            <Totals order={order} />
          </section>
        </div>

        <div className={styles.side}>
          <section className={styles.block} aria-labelledby="order-timeline-title">
            <h2 id="order-timeline-title" className={styles.blockTitle}>
              Andamento
            </h2>

            <OrderTimeline order={order} />
          </section>

          <section className={styles.block} aria-labelledby="order-fulfillment-title">
            <h2 id="order-fulfillment-title" className={styles.blockTitle}>
              {order.fulfillment.mode === 'pickup' ? 'Retirada' : 'Entrega'}
            </h2>

            <Fulfillment order={order} />
          </section>

          <section className={styles.block} aria-labelledby="order-payment-title">
            <h2 id="order-payment-title" className={styles.blockTitle}>
              Pagamento
            </h2>

            <p className={styles.payment}>{describePayment(order)}</p>

            <p className={styles.paymentNote}>
              O pagamento e combinado com a loja no WhatsApp. Nada foi cobrado por este site.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}

/* ---- Os totais ------------------------------------------------------------ */

/**
 * As linhas de valor.
 *
 * Desconto, frete e desconto do PIX so aparecem quando existem: uma linha
 * "Desconto R$ 0,00" nao informa nada e ainda sugere que algo foi perdido.
 */
function Totals({ order }: { order: CustomerOrderDetail }) {
  const { totals } = order;

  return (
    <dl className={styles.totals}>
      <div className={styles.totalRow}>
        <dt>Subtotal</dt>
        <dd>{formatCents(totals.subtotalCents)}</dd>
      </div>

      {totals.discountTotalCents > 0 ? (
        <div className={styles.totalRow}>
          <dt>Desconto por quantidade</dt>
          <dd className={styles.discount}>-{formatCents(totals.discountTotalCents)}</dd>
        </div>
      ) : null}

      {order.fulfillment.mode === 'delivery' ? (
        <div className={styles.totalRow}>
          <dt>Entrega</dt>
          <dd>{totals.deliveryFeeCents === 0 ? 'Gratis' : formatCents(totals.deliveryFeeCents)}</dd>
        </div>
      ) : null}

      {totals.pixDiscountCents > 0 ? (
        <div className={styles.totalRow}>
          <dt>Desconto no PIX</dt>
          <dd className={styles.discount}>-{formatCents(totals.pixDiscountCents)}</dd>
        </div>
      ) : null}

      <div className={`${styles.totalRow} ${styles.grandTotal}`}>
        <dt>Total</dt>
        <dd>{formatCents(totals.totalCents)}</dd>
      </div>
    </dl>
  );
}

/* ---- Entrega ou retirada --------------------------------------------------- */

/**
 * Para onde o pedido vai — ou onde ele espera.
 *
 * Na retirada, o endereco mostrado e o **da loja**, tirado das
 * configuracoes: o pedido nao guarda endereco nenhum quando nao ha entrega,
 * e "Retirada na loja" sem dizer onde fica manda a cliente procurar no
 * rodape.
 */
function Fulfillment({ order }: { order: CustomerOrderDetail }) {
  const { settings } = useStoreSettings();
  const { fulfillment } = order;

  if (fulfillment.mode === 'pickup') {
    const pickup = settings?.pickupAddress ?? null;

    return (
      <div className={styles.fulfillment}>
        <p className={styles.fulfillmentLead}>Retirada na loja</p>

        {pickup === null ? null : (
          <div className={styles.addressLines}>
            {addressLines({ ...pickup }).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

        {settings?.pickupInstructions === undefined || settings.pickupInstructions === '' ? null : (
          <p className={styles.fulfillmentNote}>{settings.pickupInstructions}</p>
        )}
      </div>
    );
  }

  const address = fulfillment.address;

  return (
    <div className={styles.fulfillment}>
      <p className={styles.fulfillmentLead}>
        <TruckIcon className={styles.fulfillmentIcon} />
        {fulfillment.cityName}
        {fulfillment.state === '' ? '' : `/${fulfillment.state}`}
      </p>

      {address === null ? null : (
        <div className={styles.addressLines}>
          {addressLines({
            street: address.street,
            number: address.number,
            complement: address.complement,
            district: address.district,
            city: '',
            state: '',
            zipCode: address.zipCode,
            reference: address.reference,
          }).map((line) => (
            <p key={line}>{line}</p>
          ))}

          {address.reference === '' ? null : (
            <p className={styles.fulfillmentNote}>Referencia: {address.reference}</p>
          )}
        </div>
      )}

      {fulfillment.estimatedDays > 0 ? (
        <p className={styles.fulfillmentNote}>
          Prazo combinado no pedido: ate {fulfillment.estimatedDays}{' '}
          {fulfillment.estimatedDays === 1 ? 'dia util' : 'dias uteis'}.
        </p>
      ) : null}
    </div>
  );
}

/** "PIX" ou "Cartao em 3x, sem juros". */
function describePayment(order: CustomerOrderDetail): string {
  const { payment } = order;

  if (payment.method === 'pix') {
    return 'PIX';
  }

  if (payment.installments <= 1) {
    return 'Cartao, a vista';
  }

  return `Cartao em ${payment.installments}x, ${payment.hasInterest ? 'com juros' : 'sem juros'}`;
}

/* ---- O pedido que nao esta aqui -------------------------------------------- */

/**
 * O `404`, escrito para quem esta olhando.
 *
 * Nao e "erro 404" e nao e "algo deu errado": o pedido pode muito bem
 * existir. O que a tela sabe e que ele **nao esta nesta conta**, e o motivo
 * mais provavel e o unico acionavel — o pedido foi feito com outro telefone.
 */
function OrderNotHere({ code, error }: { code: string; error: unknown }) {
  const notFound = isApiError(error) && error.status === 404;

  return (
    <section className={styles.notHere}>
      <h1 className={styles.notHereTitle}>
        {notFound ? `O pedido ${code} nao esta nesta conta` : 'Nao deu para abrir este pedido'}
      </h1>

      <p className={styles.notHereText}>
        {notFound
          ? 'Os pedidos ficam ligados ao telefone informado no fechamento. Se este foi feito com outro numero, fale com a loja pelo WhatsApp que ela ajusta.'
          : errorMessage(error)}
      </p>

      <ButtonLink to={ROUTES.account.orders} variant="secondary">
        Ver meus pedidos
      </ButtonLink>
    </section>
  );
}
