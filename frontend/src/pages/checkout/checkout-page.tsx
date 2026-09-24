import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Breadcrumb, Container } from '@/components/ui';
import { cartIsEmpty, useCart } from '@/features/cart';
import {
  CHECKOUT_STEPS,
  FULFILLMENT_MODES,
  checkoutStep,
  useCheckout,
  useCheckoutQuote,
  useCreateOrder,
  usePlacedOrders,
  type CheckoutAddress,
  type CheckoutQuoteView,
  type CheckoutStep,
  type CreateOrderInput,
  type OrderFailure,
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
 * ## O fecho
 *
 * O envio acontece em `useCreateOrder`, e a ordem das coisas depois do `201`
 * e deliberada: guardar o pedido no navegador, esvaziar a sacola, zerar o
 * checkout e so entao ir para `/pedido/:code`. A sacola e esvaziada **depois
 * da resposta**, nunca antes — qualquer falha no meio do caminho deixa tudo
 * exatamente onde estava, e o cliente tenta de novo sem remontar nada.
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
  const removeLine = useCart((state) => state.removeLine);

  const rememberOrder = usePlacedOrders((state) => state.remember);

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

  /**
   * O pedido ja foi fechado nesta visita.
   *
   * Em `ref`, e nao em estado, pelo mesmo motivo da trava de duplo clique em
   * `useCreateOrder`: ele precisa valer **no mesmo instante** em que e
   * escrito.
   *
   * A corrida e real e foi vista em navegador. Esvaziar a sacola e uma
   * escrita no store externo do zustand, e o React reage a ela com um render
   * proprio; a ida para `/pedido/:code` e uma navegacao assincrona do
   * roteador, que so se completa depois. No meio dos dois, a guarda de
   * "sacola vazia nao tem checkout" roda — e, com um `useState`, leria o
   * valor antigo e mandaria a pessoa para `/sacola` bem na hora em que o
   * pedido acabou de dar certo. O `ref` fecha essa janela.
   */
  const placed = useRef(false);

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
      // Guardar antes de limpar: e a unica copia que a tela de confirmacao
      // tera, e ela e montada no proximo instante.
      rememberOrder(created);

      // A sacola so e esvaziada depois da resposta de sucesso. Se o envio
      // falhar, tudo continua onde estava.
      placed.current = true;
      clearCart();
      resetCheckout();

      // `replace` para que o "voltar" do navegador nao traga a pessoa de
      // volta a um checkout que ja nao existe — a sacola esta vazia e o
      // pedido, feito.
      void navigate(ROUTES.order(created.code), { replace: true });
    },
  });

  /**
   * Sacola vazia nao tem checkout.
   *
   * `placed` segura o redirecionamento no unico caso em que a sacola fica
   * vazia de proposito — o pedido acabou de ser fechado, e mandar a pessoa
   * para a sacola vazia nesse instante a tiraria do caminho da confirmacao.
   */
  useEffect(() => {
    if (isEmpty && !placed.current) {
      void navigate(ROUTES.cart, { replace: true });
    }
  }, [isEmpty, navigate]);

  const finish = (): void => {
    const input = orderInputFrom(quoting.input, contact, address, quoting.quote?.totalCents ?? null);

    if (input === null) {
      return;
    }

    setSubmittedTotal(input.expectedTotalCents);
    order.submit(input);
  };

  /**
   * Tira da sacola o que o servidor disse que acabou, e volta aos itens.
   *
   * A alternativa — mandar o cliente achar sozinho, entre cinco linhas, qual
   * e o frasco que saiu — e o tipo de trabalho que o sistema ja sabe fazer:
   * o `409` veio com a cotacao nova, e nela cada item indisponivel esta
   * marcado. A tela remove exatamente esses e nao toca em mais nada.
   *
   * Removidos todos, a sacola pode ficar vazia. Ai a guarda acima assume e
   * leva a pessoa para `/sacola`, que e onde ela precisa estar.
   */
  const removeUnavailable = (): void => {
    for (const item of order.conflict?.quote.items ?? []) {
      if (item.unavailable) {
        removeLine(item.productId, item.variantId);
      }
    }

    order.dismissConflict();
    move(CHECKOUT_STEPS[0]);
  };

  return (
    <Container className={styles.page}>
      <Breadcrumb
        items={[
          { label: 'Início', to: ROUTES.home },
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
            failure={order.failure}
            onRetry={order.retry}
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
        onRemoveUnavailable={removeUnavailable}
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
  failure: OrderFailure | null;
  onRetry: () => void;
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
  failure,
  onRetry,
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
          failure={failure}
          onRetry={onRetry}
        />
      );
  }
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
