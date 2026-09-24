import { useEffect, useState } from 'react';
import { WhatsappIcon } from '@/components/store';
import { Radio, RadioGroup, Skeleton } from '@/components/ui';
import type { InstallmentOption } from '@/features/cart';
import {
  NO_ERRORS,
  PAYMENT_METHODS,
  fieldErrors,
  paymentSchema,
  useCheckout,
  type CheckoutQuoteView,
  type PaymentMethod,
} from '@/features/checkout';
import { usePaymentSettings } from '@/features/payments';
import { formatCents, formatInstallment } from '@/lib/format';
import { StepCard } from './step-card';
import { StepTotal } from './step-total';
import styles from './step-payment.module.css';

/**
 * Etapa 3: como o pagamento vai ser combinado.
 *
 * O verbo importa e esta na frase acima: **combinado**. Nenhum pagamento e
 * processado neste site, não há campo de cartão em lugar nenhum e nada e
 * cobrado aqui. O que esta sendo escolhido e o assunto da conversa que vai
 * acontecer no WhatsApp da loja — e e por isso que o aviso desta tela não e
 * letra miuda de rodapé, e um bloco no meio do caminho.
 *
 * Sem ele, o cliente que escolhe "Cartão" espera a próxima tela pedir o
 * número, não a encontra, e conclui que o site quebrou. O recado precisa
 * chegar antes da expectativa.
 *
 * ## Só o que a loja aceita
 *
 * PIX aparece quando há chave cadastrada; cartão, quando a dona ligou o
 * parcelamento. Uma opção desligada não e desenhada desabilitada — ela
 * simplesmente não existe, porque um radio apagado e uma pergunta sem
 * resposta. Quando sobra uma só, ela já vem marcada: não e escolha se não há
 * alternativa.
 *
 * ## As parcelas são do servidor
 *
 * A lista inteira vem de `installmentOptions`, na cotação. O navegador não
 * divide o total por seis: ele recebe "6x de R$ 80,12" pronto, com a marca
 * de juros e o total financiado ao lado. Isso importa porque esse valor vai
 * ser repetido na mensagem do WhatsApp, gravado no pedido e cobrado na
 * maquininha — e as três pontas precisam escrever o mesmo número.
 */

export interface StepPaymentProps {
  quoting: CheckoutQuoteView;
  focusOnMount: boolean;
  onContinue: () => void;
  onBack: () => void;
}

export function StepPayment({ quoting, focusOnMount, onContinue, onBack }: StepPaymentProps) {
  const method = useCheckout((state) => state.method);
  const installments = useCheckout((state) => state.installments);
  const chooseMethod = useCheckout((state) => state.chooseMethod);
  const chooseInstallments = useCheckout((state) => state.chooseInstallments);

  const { data: payments, isPending: paymentsPending } = usePaymentSettings();
  const { quote, isPending } = quoting;

  const pix = payments?.pix ?? null;
  const card = payments?.card ?? null;
  const pixAvailable = pix !== null && pix.hasKey;
  const cardAvailable = card !== null;

  const options = quote?.installmentOptions ?? [];
  const offered = options.map((option) => option.number);

  const [tried, setTried] = useState(false);
  const result = paymentSchema.safeParse({ method, installments, offered });
  const errors = tried && !result.success ? fieldErrors(result.error) : NO_ERRORS;

  /**
   * Uma forma de pagamento só não e uma escolha.
   *
   * A loja que aceita apenas PIX não deve exigir um clique para confirmar o
   * obvio — e, se exigisse, o cliente leria "escolha a forma de pagamento"
   * diante de uma única opção.
   */
  const onlyMethod = soleMethod(pixAvailable, cardAvailable);

  useEffect(() => {
    if (method === null && onlyMethod !== null) {
      chooseMethod(onlyMethod);
    }
  }, [method, onlyMethod, chooseMethod]);

  const submit = (): void => {
    setTried(true);

    if (result.success) {
      onContinue();
    }
  };

  if (!paymentsPending && !pixAvailable && !cardAvailable) {
    return (
      <StepCard
        title="Pagamento"
        focusOnMount={focusOnMount}
        actionLabel="Continuar"
        actionDisabled
        onAction={submit}
        onBack={onBack}
      >
        <p className={styles.noMethods} role="alert">
          A loja esta sem forma de pagamento configurada no momento. Fale com a gente pelo WhatsApp
          para fechar este pedido.
        </p>
      </StepCard>
    );
  }

  return (
    <StepCard
      title="Pagamento"
      description="Escolha a forma. O valor e combinado depois, pelo WhatsApp."
      focusOnMount={focusOnMount}
      actionLabel="Continuar"
      onAction={submit}
      onBack={onBack}
      total={<StepTotal quoting={quoting} />}
    >
      <RadioGroup
        legend="Forma de pagamento"
        name="payment-method"
        value={method ?? ''}
        onChange={(value) => {
          chooseMethod(value === PAYMENT_METHODS.PIX ? PAYMENT_METHODS.PIX : PAYMENT_METHODS.CARD);
        }}
        error={errors.method}
        horizontal
      >
        {pixAvailable ? (
          <Radio
            value={PAYMENT_METHODS.PIX}
            label="PIX"
            description={
              pix.discountPercent > 0
                ? `${String(pix.discountPercent)}% de desconto no total`
                : 'Chave enviada pelo WhatsApp'
            }
            card
            className={styles.choice}
          />
        ) : null}

        {cardAvailable ? (
          <Radio
            value={PAYMENT_METHODS.CARD}
            label="Cartão"
            description={`Em até ${String(card.maxInstallments)}x na maquininha`}
            card
            className={styles.choice}
          />
        ) : null}
      </RadioGroup>

      {method === PAYMENT_METHODS.PIX ? <PixPanel quote={quote} /> : null}

      {method === PAYMENT_METHODS.CARD ? (
        <Installments
          options={options}
          isPending={isPending}
          selected={installments}
          error={errors.installments}
          onChoose={chooseInstallments}
        />
      ) : null}

      <WhatsappNotice />
    </StepCard>
  );
}

/* ---- PIX ------------------------------------------------------------------ */

/**
 * Quanto o PIX tira do total.
 *
 * O percentual vem das configurações, mas o valor em reais vem da cotação —
 * `pixDiscountCents`, já calculado sobre este subtotal. A tela não multiplica
 * o total por 5%: o desconto do PIX tem regra de arredondamento própria no
 * servidor, e um centavo de diferença entre o que a tela promete e o que a
 * mensagem do WhatsApp registra e uma conversa desnecessaria na hora de
 * cobrar.
 */
function PixPanel({ quote }: { quote: CheckoutQuoteView['quote'] }) {
  const discount = quote?.pixDiscountCents ?? 0;

  return (
    <div className={styles.panel}>
      <p className={styles.panelRow}>
        <span>Desconto no PIX</span>

        <strong className={styles.panelValue}>
          {discount > 0 ? `-${formatCents(discount)}` : 'Sem desconto'}
        </strong>
      </p>

      <p className={styles.panelNote}>
        A chave chega na conversa do WhatsApp, junto com o resumo do pedido.
      </p>
    </div>
  );
}

/* ---- Cartão --------------------------------------------------------------- */

/**
 * As parcelas, como a cotação as devolveu.
 *
 * Cada opção diz três coisas: quantas vezes, quanto e cada uma, e se há
 * juros. A terceira e a que costuma faltar nas lojas e a que decide a
 * escolha — e quando há juros, o total financiado aparece junto, porque "6x
 * de R$ 80,12" sem o total esconde exatamente o que o cliente precisa
 * comparar.
 *
 * A sobra de arredondamento cai na primeira parcela, e isso também e dito
 * quando acontece: ninguém deve descobrir na maquininha que a primeira veio
 * dois centavos maior.
 */
function Installments({
  options,
  isPending,
  selected,
  error,
  onChoose,
}: {
  options: readonly InstallmentOption[];
  isPending: boolean;
  selected: number;
  error: string | undefined;
  onChoose: (installments: number) => void;
}) {
  if (isPending) {
    return (
      <div className={styles.installmentsLoading}>
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="65%" />
      </div>
    );
  }

  if (options.length === 0) {
    return <p className={styles.panelNote}>Pagamento a vista na maquininha.</p>;
  }

  return (
    <RadioGroup
      legend="Em quantas vezes"
      name="installments"
      value={String(selected)}
      onChange={(value) => {
        onChoose(Number(value));
      }}
      error={error}
      className={styles.installments}
    >
      {options.map((option) => (
        <Radio
          key={option.number}
          value={String(option.number)}
          label={
            option.number === 1
              ? `A vista · ${formatCents(option.installmentCents)}`
              : formatInstallment(option.number, option.installmentCents)
          }
          description={<InstallmentNote option={option} />}
          className={styles.installment}
        />
      ))}
    </RadioGroup>
  );
}

function InstallmentNote({ option }: { option: InstallmentOption }) {
  const unevenFirst =
    option.number > 1 && option.firstInstallmentCents !== option.installmentCents;

  return (
    <>
      <span className={option.hasInterest ? styles.interest : styles.noInterest}>
        {option.hasInterest ? `Com juros · total ${formatCents(option.totalCents)}` : 'Sem juros'}
      </span>

      {unevenFirst ? (
        <span className={styles.firstNote}>
          {' '}
          · primeira de {formatCents(option.firstInstallmentCents)}
        </span>
      ) : null}
    </>
  );
}

/* ---- O aviso que evita o mal-entendido ------------------------------------ */

function WhatsappNotice() {
  return (
    <div className={styles.notice}>
      <WhatsappIcon className={styles.noticeIcon} width={24} height={24} />

      <div>
        <p className={styles.noticeTitle}>Nada e cobrado neste site</p>

        <p className={styles.noticeText}>
          Você não digita dados de cartão aqui. Ao finalizar, o pedido vai para o WhatsApp da loja,
          e e por lá que o pagamento e combinado — chave PIX ou maquininha na entrega.
        </p>
      </div>
    </div>
  );
}

/* ---- Auxiliares ----------------------------------------------------------- */

/** A única forma aceita, quando há só uma. `null` quando há duas ou nenhuma. */
function soleMethod(pixAvailable: boolean, cardAvailable: boolean): PaymentMethod | null {
  if (pixAvailable && !cardAvailable) {
    return PAYMENT_METHODS.PIX;
  }

  if (cardAvailable && !pixAvailable) {
    return PAYMENT_METHODS.CARD;
  }

  return null;
}

