import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { CheckIcon, WhatsappIcon } from '@/components/store';
import { Button, ButtonLink, Container } from '@/components/ui';
import { useCustomerSession } from '@/features/auth';
import {
  FULFILLMENT_MODES,
  placedOrderBy,
  reserveWhatsappTab,
  usePlacedOrders,
  type PlacedOrder,
} from '@/features/checkout';
import { cx } from '@/lib/cx';
import { formatCents, formatDate, formatPhone } from '@/lib/format';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './order-confirmation-page.module.css';

/**
 * `/pedido/:code`: o fim do caminho.
 *
 * A pessoa atravessou catalogo, sacola e quatro etapas de checkout, e esta e
 * a tela que diz se valeu. Por isso ela e curta e tem uma coisa so em
 * destaque: o codigo. Tudo o mais — reenviar, copiar, criar conta, voltar a
 * loja — esta abaixo dele, na ordem em que faz falta.
 *
 * ## A confirmacao e o que ja aconteceu
 *
 * Quando esta tela aparece, o pedido **existe** no banco e a aba do WhatsApp
 * ja foi disparada. O texto nao promete, informa: "confira o WhatsApp da
 * loja", e nao "clique para enviar". O botao de reenviar existe para o caso
 * de o navegador ter bloqueado a aba — nao e o caminho normal, e por isso e
 * secundario.
 *
 * ## De onde sai o pedido desta tela
 *
 * Do proprio navegador, guardado no instante em que o servidor respondeu —
 * ver `placed-orders`. Nao ha rota publica para ler um pedido pelo codigo, e
 * e melhor que nao haja: um endereco adivinhavel devolvendo nome, telefone e
 * endereco de quem comprou seria um vazamento a espera de um robo.
 *
 * O preco disso e o caso do link aberto em outro aparelho, que cai no estado
 * de "nao esta guardado aqui". Ele nao e um erro, e a tela nao o trata como
 * um: o pedido foi feito, a loja o tem, e o caminho para ve-lo e a conta.
 *
 * ## Fora do indice
 *
 * `noindex`, como o checkout e a sacola: e a tela de uma pessoa so.
 */
export default function OrderConfirmationPage() {
  const { code = '' } = useParams<{ code: string }>();
  const order = usePlacedOrders(placedOrderBy(code));

  usePageMeta({
    title: `Pedido ${code} — Maison Essence`,
    description: 'Seu pedido foi registrado. Confira a conversa no WhatsApp da loja.',
    robots: 'noindex',
  });

  return (
    <Container className={styles.page}>
      {order === null ? <NotHere code={code} /> : <Confirmation order={order} />}
    </Container>
  );
}

/* ---- O pedido fechado ------------------------------------------------------ */

function Confirmation({ order }: { order: PlacedOrder }) {
  const hasWhatsapp = order.whatsappUrl !== '';

  return (
    <div className={styles.sheet}>
      <div className={styles.hero}>
        {/*
         * O unico momento de movimento da tela, e ele e o assunto dela: o
         * traco do certo se desenhando. Um segundo, uma vez, e nada mais se
         * mexe depois — a pessoa acabou de fazer uma coisa importante, e a
         * tela confirma sem pedir atencao de novo.
         */}
        <span className={styles.mark} aria-hidden="true">
          <CheckIcon className={styles.markIcon} width="32" height="32" />
        </span>

        <h1 className={styles.title}>Pedido finalizado</h1>

        <p className={styles.codeLabel}>Código do pedido</p>
        <p className={cx(styles.code, 'tabular')}>{order.code}</p>

        <p className={styles.instruction}>
          {hasWhatsapp ? (
            <>
              Confira agora o <strong>WhatsApp da loja</strong>: a conversa abriu com o resumo
              escrito, e e por ela que combinamos o pagamento
              {order.mode === FULFILLMENT_MODES.DELIVERY ? ' e a entrega' : ' e a retirada'}.
            </>
          ) : (
            <>
              Guarde este código e fale com a loja para combinar o pagamento. Copie a mensagem
              abaixo: ela tem o seu pedido inteiro, pronta para enviar.
            </>
          )}
        </p>

        <div className={styles.actions}>
          {hasWhatsapp ? <ResendButton url={order.whatsappUrl} /> : null}

          <CopyButton message={order.whatsappMessage} primary={!hasWhatsapp} />
        </div>

        {hasWhatsapp ? (
          <p className={styles.blocked}>
            A aba do WhatsApp não abriu? Use o botão acima — o pedido já esta registrado, e
            reenviar não cria outro.
          </p>
        ) : null}
      </div>

      <Recap order={order} />

      <AccountInvite order={order} />

      <ButtonLink variant="ghost" to={ROUTES.products} className={styles.back}>
        Voltar a loja
      </ButtonLink>
    </div>
  );
}

/* ---- Os dois botoes do fecho ----------------------------------------------- */

/**
 * A segunda chance de abrir a conversa.
 *
 * Passa pela mesma reserva de aba do envio original, e nao por um
 * `window.open` direto: e o mesmo encadeamento de saidas — aba nova, segunda
 * tentativa, aba atual —, e quem chega a este botao e justamente quem ja foi
 * bloqueado uma vez.
 *
 * A URL vai como o servidor a mandou. Nenhuma parte dela e remontada aqui:
 * e o que mantem a quebra de linha e o acento identicos aos do pedido
 * gravado.
 */
function ResendButton({ url }: { url: string }) {
  return (
    <Button
      variant="secondary"
      onClick={() => {
        reserveWhatsappTab().send(url);
      }}
    >
      <WhatsappIcon width="18" height="18" />
      Reenviar pelo WhatsApp
    </Button>
  );
}

/** Quanto tempo o botao fica dizendo que copiou. */
const COPIED_FEEDBACK_MS = 2600;

/**
 * A mensagem do pedido na area de transferencia.
 *
 * E a saida de quem prefere colar a conversa que ja tem aberta com a loja, e
 * a unica saida de quem esta num aparelho onde o `wa.me` nao abre. O texto e
 * o `whatsappMessage` gravado no pedido, sem codificacao de URL — colar
 * `%0A` no lugar da quebra de linha seria pior do que nao ter o botao.
 *
 * ## Quando a area de transferencia nao existe
 *
 * `navigator.clipboard` exige contexto seguro e permissao, e as duas coisas
 * faltam com frequencia: HTTP na rede local, navegador antigo, WebView de
 * aplicativo. Em vez de um erro, o botao revela o texto num campo ja
 * selecionado — dois toques e o menu de copiar do proprio sistema.
 */
function CopyButton({ message, primary }: { message: string; primary: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  useEffect(() => {
    if (state !== 'copied') {
      return;
    }

    const timer = setTimeout(() => {
      setState('idle');
    }, COPIED_FEEDBACK_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [state]);

  const copy = (): void => {
    // Tipado como opcional de proposito: o `lib.dom` promete um `Clipboard`
    // sempre, e o navegador nao cumpre essa promessa fora de contexto
    // seguro — e justamente esse o caso que este botao precisa cobrir.
    const clipboard: Clipboard | undefined = navigator.clipboard;

    if (clipboard === undefined) {
      setState('manual');

      return;
    }

    void clipboard.writeText(message).then(
      () => {
        setState('copied');
      },
      () => {
        setState('manual');
      },
    );
  };

  return (
    <>
      <Button variant={primary ? 'primary' : 'ghost'} onClick={copy}>
        {state === 'copied' ? (
          <>
            <CheckIcon width="18" height="18" />
            Mensagem copiada
          </>
        ) : (
          'Copiar mensagem do pedido'
        )}
      </Button>

      {/* O aviso do copiar e visual demais para quem nao ve a troca do
          rotulo. `output` ja e uma regiao viva por natureza: o leitor de tela
          anuncia o texto quando ele aparece, sem `role` nenhum. */}
      <output className="visually-hidden">
        {state === 'copied' ? 'Mensagem do pedido copiada.' : ''}
      </output>

      {state === 'manual' ? <ManualCopy message={message} /> : null}
    </>
  );
}

/**
 * O texto a mao, quando o navegador nao deixou copiar.
 *
 * Selecionado assim que aparece: o proximo gesto e o menu do sistema, e nao
 * arrastar o dedo por trinta linhas de mensagem.
 */
function ManualCopy({ message }: { message: string }) {
  return (
    <div className={styles.manual}>
      <p className={styles.manualHint}>
        Seu navegador não deixou copiar sozinho. O texto esta selecionado abaixo:
      </p>

      <textarea
        className={styles.manualText}
        readOnly
        rows={8}
        value={message}
        aria-label="Mensagem do pedido"
        ref={(node) => {
          node?.select();
        }}
      />
    </div>
  );
}

/* ---- O que foi fechado ------------------------------------------------------ */

/**
 * O resumo curto, para conferir sem sair da tela.
 *
 * Quatro linhas, e nao o pedido inteiro: a lista de itens com precos esta na
 * mensagem do WhatsApp, que o cliente acabou de receber, e repeti-la aqui so
 * faria o codigo do pedido disputar espaco com ela.
 */
function Recap({ order }: { order: PlacedOrder }) {
  return (
    <dl className={styles.recap}>
      <div className={styles.row}>
        <dt>Itens</dt>
        <dd>
          {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'}
        </dd>
      </div>

      <div className={styles.row}>
        <dt>{order.mode === FULFILLMENT_MODES.DELIVERY ? 'Entrega' : 'Retirada'}</dt>
        <dd>
          {order.mode === FULFILLMENT_MODES.DELIVERY
            ? `Em casa${order.cityName === '' ? '' : `, ${order.cityName}`}`
            : 'Na loja'}
        </dd>
      </div>

      <div className={styles.row}>
        <dt>Feito em</dt>
        <dd>{formatDate(order.placedAt)}</dd>
      </div>

      <div className={cx(styles.row, styles.totalRow)}>
        <dt>Total</dt>
        <dd className="tabular">{formatCents(order.totalCents)}</dd>
      </div>
    </dl>
  );
}

/* ---- A conta, que continua sendo opcional ---------------------------------- */

/**
 * O convite — e ele nunca vira exigencia.
 *
 * Quem ja esta logado ve o caminho para os proprios pedidos. Quem comprou
 * como convidado ve a oferta, com o telefone do pedido ja no link: e por ele
 * que o servidor liga as compras antigas a conta nova, e dizer isso e o que
 * torna a oferta interessante — "seus pedidos anteriores aparecem la" vale
 * mais do que "crie uma conta".
 *
 * Em nenhum dos dois casos ha parede: a tela inteira funciona sem conta
 * nenhuma, e este bloco e o ultimo da pagina de proposito.
 */
function AccountInvite({ order }: { order: PlacedOrder }) {
  const customer = useCustomerSession((state) => state.user);

  if (customer !== null) {
    return (
      <section className={styles.invite}>
        <p className={styles.inviteText}>
          Este pedido ficou na sua conta, com os anteriores.
        </p>

        <ButtonLink variant="secondary" to={ROUTES.account.orders}>
          Ver meus pedidos
        </ButtonLink>
      </section>
    );
  }

  return (
    <section className={styles.invite}>
      <h2 className={styles.inviteTitle}>Quer acompanhar seus pedidos?</h2>

      <p className={styles.inviteText}>
        Crie uma conta com o mesmo número deste pedido —{' '}
        <strong className="tabular">{formatPhone(order.customerPhone)}</strong> — e ele aparece
        lá junto com tudo o que você já comprou na loja, sem precisar procurar a conversa.
      </p>

      <ButtonLink variant="secondary" to={ROUTES.account.registerWith(order.customerPhone)}>
        Criar minha conta
      </ButtonLink>
    </section>
  );
}

/* ---- O pedido que nao esta neste navegador --------------------------------- */

/**
 * O link chegou de outro aparelho, ou o navegador foi limpo.
 *
 * Nao e um 404 e nao se escreve como um: o pedido existe, a loja o tem, e o
 * codigo continua valendo na conversa. O que falta e o caminho ate ele — e
 * ele e a conta.
 */
function NotHere({ code }: { code: string }) {
  const customer = useCustomerSession((state) => state.user);

  return (
    <div className={cx(styles.sheet, styles.notHere)}>
      <h1 className={styles.title}>Pedido {code}</h1>

      <p className={styles.instruction}>
        Este pedido não esta guardado neste navegador — a confirmação fica no aparelho em que o
        pedido foi fechado. Ele continua valendo: mande o código acima no WhatsApp da loja e a
        dona acha a conversa.
      </p>

      <div className={styles.actions}>
        {customer === null ? null : (
          <ButtonLink variant="secondary" to={ROUTES.account.orders}>
            Ver meus pedidos
          </ButtonLink>
        )}

        <ButtonLink variant="ghost" to={ROUTES.products}>
          Voltar a loja
        </ButtonLink>
      </div>
    </div>
  );
}
