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
 * Um componente so, usado em dois lugares: o resumo que acompanha as etapas,
 * a direita, e a revisao final, dentro do ultimo passo. Nunca aparecem
 * juntos — a pagina esconde o resumo quando chega a revisao, porque ali o
 * resumo **e** o conteudo, e ve-lo duas vezes na mesma tela divide a atencao
 * de quem esta conferindo.
 *
 * Nenhum numero daqui e calculado no navegador. Subtotal, desconto por
 * quantidade, taxa de entrega, desconto do PIX e total sao cinco campos da
 * mesma resposta de `POST /cart/quote`. Nao ha soma, nao ha subtracao e nao
 * ha multiplicacao de preco por quantidade neste arquivo — o que existe e a
 * escolha de qual campo mostrar.
 *
 * ## O total que ainda nao e o total
 *
 * Ate o cliente escolher entrega ou retirada, a cotacao sai com um modo
 * qualquer que a loja aceite, so para a rota poder responder o subtotal. A
 * taxa que volta nessa resposta nao e de ninguem — e a de uma cidade que
 * ninguem escolheu. Por isso, enquanto `totalsResolved` e `false`, a linha
 * do frete diz "a calcular" e o total mostra o subtotal.
 *
 * O que este bloco nunca faz e somar o subtotal com uma taxa por conta
 * propria para adiantar o total. Seria a unica conta do checkout feita no
 * navegador, e seria justamente a do numero que o cliente vai pagar.
 */

export interface QuoteTotalsProps {
  quote: CartQuote | undefined;
  /** A taxa e o total desta cotacao pertencem a escolha do cliente. */
  totalsResolved: boolean;
  isPending: boolean;
  /** Ha uma cotacao no ar: os numeros em tela sao os anteriores. */
  isFetching: boolean;
}

export function QuoteTotals({ quote, totalsResolved, isPending, isFetching }: QuoteTotalsProps) {
  return (
    <>
      {/* `aria-busy` enquanto o servidor recalcula: quem ouve a pagina fica
          sabendo que o numero em tela ainda vai mudar. */}
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
          O frete entra na conta quando voce escolher entre retirar na loja e receber em casa.
        </p>
      )}

      <FreeShippingNote quote={quote} totalsResolved={totalsResolved} />
    </>
  );
}

/**
 * A linha do frete.
 *
 * Tres textos possiveis, e cada um diz uma coisa diferente: "a calcular"
 * (falta escolher), "Gratis" com o motivo que o servidor escreveu — retirada
 * na loja, cidade sem taxa, valor minimo atingido — ou o valor. O motivo
 * importa: "Gratis" sozinho deixa o cliente sem saber se aquilo vale para
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
          <span className={styles.free}>Gratis</span>
        ) : (
          formatCents(quote.deliveryFeeCents)
        )}
      </dd>
    </div>
  );
}

/**
 * "Faltam R$ 30,00 para o frete gratis".
 *
 * Os centavos que faltam vem calculados do servidor, em
 * `missingForFreeCents`. E a unica linha do bloco que pede uma acao — e ela
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
      Faltam <strong className="tabular">{formatCents(missing)}</strong> para o frete gratis nesta
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
