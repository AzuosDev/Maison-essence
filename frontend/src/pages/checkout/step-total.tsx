import { Skeleton } from '@/components/ui';
import type { CheckoutQuoteView } from '@/features/checkout';
import { formatCents } from '@/lib/format';

/**
 * O valor na linha do celular, logo acima do botao do passo.
 *
 * No desktop o resumo esta ao lado e nunca sai da tela; no celular ele fica
 * abaixo do cartao, e quem chega ao botao chegaria nele sem ter visto numero
 * nenhum. Esta linha — uma so — poe o valor no ponto da decisao.
 *
 * O rotulo muda junto com o valor, e a mudanca e a parte importante: antes
 * de o cliente escolher entrega ou retirada, o que esta em tela e o
 * **subtotal**, e chama-lo de "total" seria prometer que a conta esta
 * fechada quando o frete ainda nao entrou. Depois da escolha, e total mesmo,
 * vindo inteiro de `totalCents`.
 */
export function StepTotal({ quoting }: { quoting: CheckoutQuoteView }) {
  const { quote, totalsResolved, isPending } = quoting;

  return (
    <>
      <span>{totalsResolved ? 'Total' : 'Subtotal'}</span>

      {isPending || quote === undefined ? (
        <Skeleton variant="text" width="5rem" />
      ) : (
        <strong className="tabular">
          {formatCents(totalsResolved ? quote.totalCents : quote.subtotalCents)}
        </strong>
      )}
    </>
  );
}
