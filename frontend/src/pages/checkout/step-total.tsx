import { Skeleton } from '@/components/ui';
import type { CheckoutQuoteView } from '@/features/checkout';
import { formatCents } from '@/lib/format';
import { financedInstallment } from './financed-installment';
import styles from './step-total.module.css';

/**
 * O valor na linha do celular, logo acima do botão do passo.
 *
 * No desktop o resumo esta ao lado e nunca sai da tela; no celular ele fica
 * abaixo do cartão, e quem chega ao botão chegaria nele sem ter visto número
 * nenhum. Esta linha — uma só — põe o valor no ponto da decisão.
 *
 * O rótulo muda junto com o valor, e a mudanca e a parte importante: antes
 * de o cliente escolher entrega ou retirada, o que esta em tela e o
 * **subtotal**, e chama-lo de "total" seria prometer que a conta esta
 * fechada quando o frete ainda não entrou. Depois da escolha, e total mesmo,
 * vindo inteiro de `totalCents`.
 *
 * A segunda linha só existe no passo do pagamento, e só quando a parcela
 * escolhida tem juros: ali o cliente acabou de marcar "2x de R$ 313,01 ·
 * total R$ 626,02" a dois dedos deste número, e um total menor logo abaixo,
 * sem explicação, parece erro de conta. O valor a vista continua em cima,
 * porque e ele que o pedido grava.
 */
export function StepTotal({ quoting }: { quoting: CheckoutQuoteView }) {
  const { quote, totalsResolved, isPending } = quoting;
  const financed = financedInstallment(quote, totalsResolved);

  return (
    <>
      <span>{totalsResolved ? 'Total' : 'Subtotal'}</span>

      <span className={styles.value}>
        {isPending || quote === undefined ? (
          <Skeleton variant="text" width="5rem" />
        ) : (
          <strong className="tabular">
            {formatCents(totalsResolved ? quote.totalCents : quote.subtotalCents)}
          </strong>
        )}

        {isPending || financed === null ? null : (
          <span className={styles.financed}>
            Parcelado em {financed.number}x ·{' '}
            <span className="tabular">{formatCents(financed.totalCents)}</span> com juros
          </span>
        )}
      </span>
    </>
  );
}
