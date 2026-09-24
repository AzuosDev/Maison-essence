import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui';
import type { CartQuote } from '@/features/cart';
import { FULFILLMENT_MODES } from '@/features/checkout';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import styles from './quote-totals.module.css';

/**
 * As linhas de dinheiro do pedido.
 *
 * Um componente só, usado em dois lugares: o resumo que acompanha as etapas,
 * a direita, e a revisão final, dentro do último passo. Nunca aparecem
 * juntos — a página esconde o resumo quando chega a revisão, porque ali o
 * resumo **e** o conteúdo, e vê-lo duas vezes na mesma tela divide a atenção
 * de quem esta conferindo.
 *
 * Nenhum número daqui e calculado no navegador. Subtotal, desconto por
 * quantidade, taxa de entrega, desconto do PIX e total são cinco campos da
 * mesma resposta de `POST /cart/quote`. Não há soma, não há subtração e não
 * há multiplicação de preço por quantidade neste arquivo — o que existe e a
 * escolha de qual campo mostrar.
 *
 * ## O total que ainda não e o total
 *
 * Até o cliente escolher entrega ou retirada, a cotação sai com um modo
 * qualquer que a loja aceite, só para a rota poder responder o subtotal. A
 * taxa que volta nessa resposta não e de ninguém — e a de uma cidade que
 * ninguém escolheu. Por isso, enquanto `totalsResolved` e `false`, a linha
 * do frete diz "a calcular" e o total mostra o subtotal.
 *
 * O que este bloco nunca faz e somar o subtotal com uma taxa por conta
 * própria para adiantar o total. Seria a única conta do checkout feita no
 * navegador, e seria justamente a do número que o cliente vai pagar.
 */

export interface QuoteTotalsProps {
  quote: CartQuote | undefined;
  /** A taxa e o total desta cotação pertencem a escolha do cliente. */
  totalsResolved: boolean;
  isPending: boolean;
  /** Há uma cotação no ar: os números em tela são os anteriores. */
  isFetching: boolean;
}

export function QuoteTotals({ quote, totalsResolved, isPending, isFetching }: QuoteTotalsProps) {
  return (
    <>
      {/* `aria-busy` enquanto o servidor recalcula: quem ouve a página fica
          sabendo que o número em tela ainda vai mudar. */}
      <dl className={cx(styles.lines, isFetching && styles.recalculating)} aria-busy={isFetching}>
        <Line label="Subtotal" isPending={isPending}>
          {quote === undefined ? null : formatCents(quote.subtotalCents)}
        </Line>

        {quote !== undefined && quote.discountTotalCents > 0 ? (
          <Line label="Desconto por quantidade" tone="discount" isPending={false}>
            -{formatCents(quote.discountTotalCents)}
          </Line>
        ) : null}

        <DeliveryLine quote={quote} totalsResolved={totalsResolved} isPending={isPending} />

        {quote !== undefined && quote.pixDiscountCents > 0 ? (
          <Line label="Desconto no PIX" tone="discount" isPending={false}>
            -{formatCents(quote.pixDiscountCents)}
          </Line>
        ) : null}

        <div className={cx(styles.line, styles.total)}>
          <dt>Total</dt>
          <dd>
            {isPending || quote === undefined ? (
              <Skeleton variant="text" width="6rem" />
            ) : (
              <strong className="tabular">
                {formatCents(totalsResolved ? quote.totalCents : quote.subtotalCents)}
              </strong>
            )}
          </dd>
        </div>
      </dl>

      {totalsResolved ? null : (
        <p className={styles.note}>
          O frete entra na conta quando você escolher entre retirar na loja e receber em casa.
        </p>
      )}

      <FreeShippingNote quote={quote} totalsResolved={totalsResolved} />
    </>
  );
}

/**
 * A linha do frete.
 *
 * Três textos possíveis, e cada um diz uma coisa diferente: "a calcular"
 * (falta escolher), "Grátis" com o motivo que o servidor escreveu — retirada
 * na loja, cidade sem taxa, valor mínimo atingido — ou o valor. O motivo
 * importa: "Grátis" sozinho deixa o cliente sem saber se aquilo vale para
 * ele ou se foi engano da tela.
 */
function DeliveryLine({
  quote,
  totalsResolved,
  isPending,
}: {
  quote: CartQuote | undefined;
  totalsResolved: boolean;
  isPending: boolean;
}) {
  if (!totalsResolved || quote === undefined) {
    return (
      <div className={styles.line}>
        <dt>Frete</dt>
        <dd className={styles.pending}>a calcular</dd>
      </div>
    );
  }

  const { fulfillment } = quote;

  return (
    <div className={styles.line}>
      <dt>
        {fulfillment.mode === FULFILLMENT_MODES.PICKUP ? 'Retirada na loja' : 'Entrega'}

        {fulfillment.cityName === '' ? null : (
          <span className={styles.city}>{fulfillment.cityName}</span>
        )}
      </dt>

      <dd className="tabular">
        {isPending ? (
          <Skeleton variant="text" width="5rem" />
        ) : fulfillment.isFree ? (
          <span className={styles.free}>Grátis</span>
        ) : (
          formatCents(quote.deliveryFeeCents)
        )}
      </dd>
    </div>
  );
}

/**
 * "Faltam R$ 30,00 para o frete grátis".
 *
 * Os centavos que faltam vem calculados do servidor, em
 * `missingForFreeCents`. E a única linha do bloco que pede uma ação — e ela
 * se paga: e o recado que faz a sacola crescer, e some sozinho quando o
 * valor e atingido.
 */
function FreeShippingNote({
  quote,
  totalsResolved,
}: {
  quote: CartQuote | undefined;
  totalsResolved: boolean;
}) {
  const missing = quote?.fulfillment.missingForFreeCents ?? null;

  if (!totalsResolved || missing === null || missing <= 0) {
    return null;
  }

  return (
    <p className={styles.freeHint}>
      Faltam <strong className="tabular">{formatCents(missing)}</strong> para o frete grátis nesta
      cidade.
    </p>
  );
}

function Line({
  label,
  tone,
  isPending,
  children,
}: {
  label: string;
  tone?: 'discount';
  isPending: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.line}>
      <dt>{label}</dt>
      <dd className={cx(tone === 'discount' && styles.discount, 'tabular')}>
        {isPending || children === null ? <Skeleton variant="text" width="5rem" /> : children}
      </dd>
    </div>
  );
}
