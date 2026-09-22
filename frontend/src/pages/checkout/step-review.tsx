import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui';
import {
  CHECKOUT_STEPS,
  FULFILLMENT_MODES,
  NO_ERRORS,
  PAYMENT_METHODS,
  contactSchema,
  fieldErrors,
  useCheckout,
  type CheckoutQuoteView,
  type CheckoutStep,
} from '@/features/checkout';
import { formatCents, formatInstallment, maskPhone } from '@/lib/format';
import { QuoteTotals } from './quote-totals';
import { StepCard } from './step-card';
import styles from './step-review.module.css';

/**
 * Etapa 4: quem esta comprando, e a conferencia de tudo.
 *
 * Dois pedacos com papeis opostos. Em cima, os unicos dois campos que ainda
 * faltam — nome e WhatsApp. Embaixo, nada para preencher: o que o cliente
 * escolheu, escrito por extenso, com um "alterar" ao lado de cada bloco.
 *
 * O "alterar" e o que torna a revisao util. Uma revisao que so mostra
 * obriga quem viu o bairro errado a procurar o caminho de volta — e ele,
 * num fluxo de quatro passos, e tres cliques no "voltar". Com o atalho, e
 * um.
 *
 * ## Dois campos, e nao cinco
 *
 * Nao ha e-mail, nao ha CPF, nao ha confirmacao de senha. A loja fala pelo
 * WhatsApp, e o telefone e a chave que liga o pedido ao cliente — cada campo
 * a mais neste ponto e uma chance a mais de a pessoa desistir na ultima
 * tela, que e onde a desistencia custa tudo o que ja foi feito.
 *
 * ## A mascara que nunca recusa tecla
 *
 * `maskPhone` so acrescenta os parenteses e o hifen; nunca reordena nem
 * corta o que foi digitado no meio. A validacao e `normalizePhone`, a mesma
 * funcao que o backend usa — o que passa aqui passa la, e ninguem descobre
 * que o numero era invalido depois de o pedido sair.
 */

export interface StepReviewProps {
  quoting: CheckoutQuoteView;
  focusOnMount: boolean;
  onBack: () => void;
  /** O atalho de cada bloco da revisao. */
  onGoTo: (step: CheckoutStep) => void;
  /** Os dados estao validos: a pagina monta e envia o pedido. */
  onFinish: () => void;
  isSubmitting: boolean;
  /** O que deu errado no envio, quando nao foi conflito de cotacao. */
  submitError: string | null;
}

export function StepReview({
  quoting,
  focusOnMount,
  onBack,
  onGoTo,
  onFinish,
  isSubmitting,
  submitError,
}: StepReviewProps) {
  const contact = useCheckout((state) => state.contact);
  const setContactField = useCheckout((state) => state.setContactField);

  const [tried, setTried] = useState(false);
  const result = contactSchema.safeParse(contact);
  const errors = tried && !result.success ? fieldErrors(result.error) : NO_ERRORS;

  const submit = (): void => {
    setTried(true);

    if (result.success) {
      onFinish();
    }
  };

  return (
    <StepCard
      title="Seus dados"
      description="E por aqui que a loja vai falar com voce para combinar o pagamento."
      focusOnMount={focusOnMount}
      actionLabel="Finalizar pelo WhatsApp"
      onAction={submit}
      onBack={onBack}
      actionLoading={isSubmitting}
      // Sem a linha de total do rodape, que os outros passos tem. Aqui o
      // bloco de valores esta dentro do proprio cartao, a dois dedos do
      // botao: a linha repetiria o mesmo numero duas vezes na mesma dobra do
      // celular.
    >
      <div className={styles.fields}>
        <Input
          label="Nome"
          value={contact.name}
          autoComplete="name"
          placeholder="Como a loja deve te chamar"
          error={errors.name}
          disabled={isSubmitting}
          onChange={(event) => {
            setContactField('name', event.target.value);
          }}
        />

        <Input
          label="WhatsApp"
          value={contact.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(88) 99999-9999"
          error={errors.phone}
          disabled={isSubmitting}
          onChange={(event) => {
            setContactField('phone', maskPhone(event.target.value));
          }}
        />
      </div>

      <Review quoting={quoting} onGoTo={onGoTo} />

      <div className={styles.totals}>
        <h3 className={styles.totalsTitle}>Valores</h3>

        <QuoteTotals
          quote={quoting.quote}
          totalsResolved={quoting.totalsResolved}
          isPending={quoting.isPending}
          isFetching={quoting.isFetching}
        />
      </div>

      {submitError === null ? null : (
        <p className={styles.error} role="alert">
          {submitError}
        </p>
      )}

      <p className={styles.reassurance}>
        Ao finalizar, abrimos o WhatsApp da loja com o resumo do pedido escrito. Nada e cobrado
        neste site.
      </p>
    </StepCard>
  );
}

/* ---- A conferencia --------------------------------------------------------- */

function Review({
  quoting,
  onGoTo,
}: {
  quoting: CheckoutQuoteView;
  onGoTo: (step: CheckoutStep) => void;
}) {
  const mode = useCheckout((state) => state.mode);
  const address = useCheckout((state) => state.address);
  const method = useCheckout((state) => state.method);
  const installments = useCheckout((state) => state.installments);

  const { quote } = quoting;
  const isPickup = mode === FULFILLMENT_MODES.PICKUP;

  return (
    <div className={styles.review}>
      <Block title="Itens" step={CHECKOUT_STEPS[0]} onGoTo={onGoTo}>
        <ul className={styles.items}>
          {(quote?.items ?? []).map((item) => (
            <li key={`${item.productId}:${item.variantId}`} className={styles.item}>
              <span className={styles.itemName}>
                {item.quantity}x {item.productName}
                {item.variantLabel === '' ? '' : ` · ${item.variantLabel}`}
              </span>

              <span className="tabular">{formatCents(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title={isPickup ? 'Retirada' : 'Entrega'} step={CHECKOUT_STEPS[1]} onGoTo={onGoTo}>
        {isPickup ? (
          <p className={styles.line}>Voce retira na loja. Sem taxa de entrega.</p>
        ) : (
          <>
            <p className={styles.line}>
              {[address.street, address.number].filter((part) => part !== '').join(', ')}
              {address.complement === '' ? '' : ` — ${address.complement}`}
            </p>

            <p className={styles.line}>
              {address.district}
              {quote?.fulfillment.cityName ? `, ${quote.fulfillment.cityName}` : ''}
              {quote?.fulfillment.state ? `/${quote.fulfillment.state}` : ''}
            </p>

            {address.reference === '' ? null : (
              <p className={styles.hint}>Referencia: {address.reference}</p>
            )}
          </>
        )}
      </Block>

      <Block title="Pagamento" step={CHECKOUT_STEPS[2]} onGoTo={onGoTo}>
        <p className={styles.line}>
          {method === PAYMENT_METHODS.PIX ? 'PIX' : 'Cartao'}

          {method === PAYMENT_METHODS.CARD && quote?.payment.selected ? (
            <>
              {' · '}
              {installments === 1
                ? 'a vista'
                : formatInstallment(installments, quote.payment.selected.installmentCents)}
            </>
          ) : null}
        </p>

        <p className={styles.hint}>Combinado pelo WhatsApp depois de finalizar.</p>
      </Block>
    </div>
  );
}

function Block({
  title,
  step,
  onGoTo,
  children,
}: {
  title: string;
  step: CheckoutStep;
  onGoTo: (step: CheckoutStep) => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h3 className={styles.blockTitle}>{title}</h3>

        {/* O rotulo acessivel diz o que sera alterado: numa revisao com tres
            blocos, tres botoes chamados so "Alterar" nao dizem qual e qual
            para quem ouve a pagina. */}
        <button
          type="button"
          className={styles.change}
          onClick={() => {
            onGoTo(step);
          }}
          aria-label={`Alterar ${title.toLowerCase()}`}
        >
          Alterar
        </button>
      </div>

      <div className={styles.blockBody}>{children}</div>
    </section>
  );
}
