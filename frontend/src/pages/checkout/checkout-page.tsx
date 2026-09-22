import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Breadcrumb, Button, ButtonLink, Container } from '@/components/ui';
import { cartIsEmpty, useCart } from '@/features/cart';
import {
  CHECKOUT_STEPS,
  FULFILLMENT_MODES,
  checkoutStep,
  useCheckout,
  useCheckoutQuote,
  useCreateOrder,
  type CheckoutAddress,
  type CheckoutQuoteView,
  type CheckoutStep,
  type CreateOrderInput,
  type CreatedOrder,
  type QuoteInput,
} from '@/features/checkout';
import { cx } from '@/lib/cx';
import { normalizePhone } from '@/lib/format';
import { usePageMeta } from '@/lib/use-page-meta';
import { CheckoutProgress } from './checkout-progress';
import { CheckoutSummary } from './checkout-summary';
import { QuoteConflictModal } from './quote-conflict-modal';
import { StepFulfillment } from './step-fulfillment';
import { StepItems } from './step-items';
import { StepPayment } from './step-payment';
import { StepReview } from './step-review';
import styles from './checkout-page.module.css';

/**
 * `/checkout`: as quatro etapas, em uma pagina so.
 *
 * Um endereco, quatro passos, sem rota por etapa. A escolha tem
 * consequencias e as duas maiores sao boas: o botao "voltar" do navegador
 * sai da loja em vez de desfazer um passo pela metade, e o estado do
 * checkout nao precisa ser reconstruido a cada troca de URL — ele esta no
 * armazenamento, e a pagina so le em qual passo parar.
 *
 * ## Recarregar nao perde nada
 *
 * E o criterio de aceite mais importante desta tela, e ele nao mora aqui:
 * mora em `checkout.store`, que grava etapa, modo, cidade, endereco,
 * pagamento, parcelamento, nome e telefone no `localStorage` a cada
 * mudanca. Esta pagina simplesmente le o passo de la e desenha. Quem
 * recarrega no meio do endereco volta no meio do endereco, com o que ja
 * tinha escrito.
 *
 * O que **nao** sobrevive e o total: ele nunca foi guardado. A cotacao e
 * refeita na montagem, contra o catalogo de agora, e e por isso que voltar
 * horas depois mostra o preco de hoje em vez do de ontem.
 *
 * ## Tres blocos
 *
 * Trilha em cima, passo no meio, resumo a direita. No celular a trilha vira
 * uma linha de contagem e o resumo desce para baixo do passo — que e a ordem
 * em que a pessoa precisa deles: primeiro o que fazer, depois quanto da.
 *
 * Na ultima etapa o resumo lateral sai de cena. A revisao **e** o resumo, e
 * manter os dois lado a lado faria o cliente conferir os mesmos cinco
 * numeros em dois lugares da mesma tela.
 *
 * ## Fora do indice
 *
 * `noindex`, como a sacola: esta pagina e de uma pessoa so e nao tem nada a
 * dizer a quem chega pelo Google.
 */
export default function CheckoutPage() {
  const navigate = useNavigate();

  const step = useCheckout(checkoutStep);
  const goTo = useCheckout((state) => state.goTo);
  const advance = useCheckout((state) => state.advance);
  const goBack = useCheckout((state) => state.goBack);
  const resetCheckout = useCheckout((state) => state.reset);
  const contact = useCheckout((state) => state.contact);
  const address = useCheckout((state) => state.address);

  const isEmpty = useCart(cartIsEmpty);
  const clearCart = useCart((state) => state.clear);

  const quoting = useCheckoutQuote();

  usePageMeta({
    title: 'Finalizar pedido — Maison Essence',
    description: 'Escolha a entrega, a forma de pagamento e feche seu pedido pelo WhatsApp.',
    robots: 'noindex',
  });

  /**
   * O cliente ja navegou entre passos nesta visita.
   *
   * Comeca `false` para que a chegada a pagina deixe o foco no topo, com o
   * cabecalho e a trilha. A partir do primeiro avanco, cada troca de passo
   * leva o foco para o titulo do passo novo — ver `StepCard`.
   *
   * Estado, e nao `ref`, porque o valor e **lido durante o render**: ele vai
   * como prop para o passo. Em `ref`, a leitura aconteceria antes de o React
   * garantir que o valor novo e o que esta em tela — e a regra existe
   * justamente para os casos em que isso da errado em silencio.
   */
  const [moved, setMoved] = useState(false);

  const move = (to: CheckoutStep): void => {
    setMoved(true);
    goTo(to);
  };

  /** O pedido fechado. Segura o redirecionamento da sacola vazia. */
  const [placed, setPlaced] = useState<CreatedOrder | null>(null);

  /**
   * O total que estava na tela no momento do envio.
   *
   * Congelado aqui, e nao lido da cotacao quando o `409` chega: quando ele
   * chega, a cotacao em tela ja pode ter sido revalidada e mostrar outro
   * numero. O modal compara o que o cliente **viu** com o que o servidor
   * calculou, e o primeiro dos dois so existe neste instante.
   */
  const [submittedTotal, setSubmittedTotal] = useState(0);

  const order = useCreateOrder({
    onSuccess: (created) => {
      // A sacola so e esvaziada depois da resposta de sucesso. Se o envio
      // falhar, tudo continua onde estava.
      setPlaced(created);
      clearCart();
      resetCheckout();

      if (created.whatsappUrl !== '') {
        // Na mesma aba, e de proposito: uma aba nova aberta depois de uma
        // promessa e bloqueada pelo Safari no iOS, e o pedido ficaria criado
        // sem a conversa acontecer. O painel abaixo cobre o caso de a
        // navegacao nao acontecer por qualquer outro motivo.
        window.location.assign(created.whatsappUrl);
      }
    },
  });

  /**
   * Sacola vazia nao tem checkout.
   *
   * `placed` segura o redirecionamento no unico caso em que a sacola fica
   * vazia de proposito — o pedido acabou de ser fechado, e mandar a pessoa
   * para a sacola vazia nesse instante apagaria o codigo do pedido da tela.
   */
  useEffect(() => {
    if (isEmpty && placed === null) {
      void navigate(ROUTES.cart, { replace: true });
    }
  }, [isEmpty, placed, navigate]);

  if (placed !== null) {
    return <OrderPlaced order={placed} />;
  }

  const finish = (): void => {
    const input = orderInputFrom(quoting.input, contact, address, quoting.quote?.totalCents ?? null);

    if (input === null) {
      return;
    }

    setSubmittedTotal(input.expectedTotalCents);
    order.submit(input);
  };

  return (
    <Container className={styles.page}>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: ROUTES.home },
          { label: 'Sacola', to: ROUTES.cart },
          { label: 'Finalizar' },
        ]}
        className={styles.breadcrumb}
      />

      <h1 className={styles.heading}>Finalizar pedido</h1>

      <div className={cx(styles.body, step === 'review' && styles.narrow)}>
        <div className={styles.column}>
          <CheckoutProgress current={step} onGoTo={move} locked={order.isSubmitting} />

          {/* A etapa entra como `key`: trocar de passo remonta o cartao, e e
              essa remontagem que zera o "ja tentei enviar" de cada
              formulario e dispara o foco no titulo novo. */}
          <Step
            key={step}
            step={step}
            quoting={quoting}
            focusOnMount={moved}
            onAdvance={() => {
              setMoved(true);
              advance();
            }}
            onBack={() => {
              setMoved(true);
              goBack();
            }}
            onGoTo={move}
            onFinish={finish}
            isSubmitting={order.isSubmitting}
            submitError={order.error}
          />
        </div>

        {step === 'review' ? null : (
          <CheckoutSummary
            quote={quoting.quote}
            totalsResolved={quoting.totalsResolved}
            isPending={quoting.isPending}
            isFetching={quoting.isFetching}
            isError={quoting.isError}
            onRetry={quoting.refetch}
            itemCount={quoting.available.reduce((total, item) => total + item.quantity, 0)}
          />
        )}
      </div>

      <QuoteConflictModal
        conflict={order.conflict}
        previousTotalCents={submittedTotal}
        onConfirm={order.acceptConflict}
        onReview={() => {
          order.dismissConflict();
          move(CHECKOUT_STEPS[0]);
        }}
        onClose={order.dismissConflict}
      />
    </Container>
  );
}

/* ---- O passo da vez -------------------------------------------------------- */

interface StepProps {
  step: CheckoutStep;
  quoting: CheckoutQuoteView;
  focusOnMount: boolean;
  onAdvance: () => void;
  onBack: () => void;
  onGoTo: (step: CheckoutStep) => void;
  onFinish: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

function Step({
  step,
  quoting,
  focusOnMount,
  onAdvance,
  onBack,
  onGoTo,
  onFinish,
  isSubmitting,
  submitError,
}: StepProps) {
  switch (step) {
    case 'items':
      return (
        <StepItems quoting={quoting} focusOnMount={focusOnMount} onContinue={onAdvance} />
      );

    case 'fulfillment':
      return (
        <StepFulfillment
          quoting={quoting}
          focusOnMount={focusOnMount}
          onContinue={onAdvance}
          onBack={onBack}
        />
      );

    case 'payment':
      return (
        <StepPayment
          quoting={quoting}
          focusOnMount={focusOnMount}
          onContinue={onAdvance}
          onBack={onBack}
        />
      );

    case 'review':
      return (
        <StepReview
          quoting={quoting}
          focusOnMount={focusOnMount}
          onBack={onBack}
          onGoTo={onGoTo}
          onFinish={onFinish}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      );
  }
}

/* ---- O pedido fechado ------------------------------------------------------ */

/**
 * O que fica na tela depois que o pedido existe.
 *
 * A navegacao para o WhatsApp ja foi disparada; este painel e a rede de
 * seguranca — o navegador pode te-la bloqueado, e a loja pode nao ter numero
 * cadastrado. Nos dois casos o pedido **existe**, e o codigo dele precisa
 * estar visivel: e por ele que a loja acha a conversa.
 *
 * A tela de confirmacao propria, em `/pedido/:code`, com "reenviar pelo
 * WhatsApp" e "copiar a mensagem", e o passo seguinte do plano. Este painel
 * e o minimo para que o fluxo nao termine numa tela em branco.
 */
function OrderPlaced({ order }: { order: CreatedOrder }) {
  return (
    <Container className={styles.page}>
      <div className={styles.placed}>
        <p className={styles.placedTitle}>Pedido registrado</p>

        <p className={styles.placedCode}>{order.code}</p>

        <p className={styles.placedText}>
          {order.whatsappUrl === ''
            ? 'Guarde este codigo e fale com a loja para combinar o pagamento.'
            : 'Estamos abrindo o WhatsApp da loja com o resumo do seu pedido.'}
        </p>

        {order.whatsappUrl === '' ? null : (
          <Button
            onClick={() => {
              window.location.assign(order.whatsappUrl);
            }}
          >
            Abrir o WhatsApp
          </Button>
        )}

        <ButtonLink variant="ghost" to={ROUTES.products}>
          Voltar a loja
        </ButtonLink>
      </div>
    </Container>
  );
}

/* ---- O corpo do pedido ------------------------------------------------------ */

/**
 * O pedido, montado a partir do que produziu o total na tela.
 *
 * Os itens, a entrega e o pagamento saem do **mesmo** `input` que gerou a
 * cotacao — e nao de uma segunda leitura do estado. Remontar aqui abriria a
 * chance de um campo sair diferente do que o servidor acabou de cotar, e o
 * pedido seria recusado por uma divergencia que a propria tela criou.
 *
 * O endereco so entra na entrega. Na retirada ele nem e montado: o corpo
 * sai sem o campo, que e o que o servidor espera.
 *
 * `null` quando ainda falta alguma coisa — cotacao no ar, telefone invalido.
 * Nao ha caminho pela tela que chegue aqui nesse estado; a guarda existe
 * para que, se houver um dia, o resultado seja "nao envia" em vez de um
 * pedido com o total errado.
 */
function orderInputFrom(
  input: QuoteInput | null,
  contact: { name: string; phone: string },
  address: CheckoutAddress,
  totalCents: number | null,
): CreateOrderInput | null {
  const phone = normalizePhone(contact.phone);

  if (input === null || totalCents === null || phone === null) {
    return null;
  }

  return {
    items: input.items,
    fulfillment: input.fulfillment,
    payment: input.payment,
    customer: { name: contact.name.trim(), phone },
    expectedTotalCents: totalCents,

    ...(input.fulfillment.mode === FULFILLMENT_MODES.DELIVERY
      ? {
          address: {
            street: address.street.trim(),
            number: address.number.trim(),
            complement: address.complement.trim(),
            district: address.district.trim(),
            reference: address.reference.trim(),
          },
        }
      : {}),
  };
}
