import { Button } from '@/components/ui';
import type { CartQuote } from '@/features/cart';
import { QuoteTotals } from './quote-totals';
import styles from './checkout-summary.module.css';

/**
 * O resumo que acompanha as etapas.
 *
 * A moldura, e so ela: as linhas de dinheiro sao de `QuoteTotals`, que a
 * revisao final tambem usa. O que este bloco acrescenta e o contexto — o
 * titulo, quantos itens ha e o que fazer quando a cotacao falha.
 *
 * Mesma superficie e mesma voz do resumo da sacola, de proposito: sao o
 * mesmo bloco em duas telas da mesma travessia, e o cliente precisa
 * reconhece-lo ao chegar aqui.
 *
 * Some na ultima etapa. La a revisao **e** o resumo, e mante-lo ao lado
 * faria a pessoa conferir os mesmos cinco numeros em dois lugares da mesma
 * tela — quem decide isso e a pagina, que sabe em que passo esta.
 */

export interface CheckoutSummaryProps {
  quote: CartQuote | undefined;
  /** A taxa e o total desta cotacao pertencem a escolha do cliente. */
  totalsResolved: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Quantas unidades entram no pedido. */
  itemCount: number;
}

export function CheckoutSummary({
  quote,
  totalsResolved,
  isPending,
  isFetching,
  isError,
  onRetry,
  itemCount,
}: CheckoutSummaryProps) {
  if (isError && quote === undefined) {
    return (
      <aside className={styles.summary} aria-label="Resumo do pedido">
        <h2 className={styles.title}>Resumo</h2>

        <div className={styles.failed} role="alert">
          <p className={styles.failedText}>
            Nao foi possivel calcular o total agora. Seus itens e seus dados continuam guardados.
          </p>

          <Button variant="secondary" block onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.summary} aria-label="Resumo do pedido">
      <div className={styles.head}>
        <h2 className={styles.title}>Resumo</h2>

        {itemCount > 0 ? (
          <p className={styles.count}>
            {itemCount === 1 ? '1 item' : `${String(itemCount)} itens`}
          </p>
        ) : null}
      </div>

      <QuoteTotals
        quote={quote}
        totalsResolved={totalsResolved}
        isPending={isPending}
        isFetching={isFetching}
      />
    </aside>
  );
}
