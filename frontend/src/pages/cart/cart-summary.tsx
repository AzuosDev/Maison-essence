import { Button, Skeleton } from '@/components/ui';
import type { CartQuote } from '@/features/cart';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import styles from './cart-summary.module.css';

/**
 * O resumo do pedido: o bloco da direita.
 *
 * Quatro linhas, na ordem em que a conta acontece — subtotal, desconto,
 * frete, total — e nenhuma delas calculada aqui. `subtotalCents`,
 * `discountTotalCents` e o total vem prontos de `POST /cart/quote`, contra o
 * catalogo de agora. O navegador nao multiplica preco por quantidade em
 * lugar nenhum desta tela, e essa ausencia e o motivo de o numero que o
 * cliente le ser o mesmo que ele vai pagar.
 *
 * ## "Frete a calcular" e o unico texto honesto aqui
 *
 * A loja entrega num punhado de cidades com taxa fixa por cidade, e a cidade
 * e escolhida no fechamento do pedido. Anunciar um valor antes disso exigiria
 * escolher uma cidade pelo cliente; anunciar "gratis" seria mentira em quase
 * todas. A linha diz o que e — falta um dado, e ele vem no passo seguinte —
 * e o total abaixo dela diz o que cobre: os produtos.
 *
 * ## Por que o total nao encolhe com o desconto na frente dos olhos
 *
 * O `subtotalCents` **ja vem com o desconto por quantidade aplicado**; a
 * linha de desconto e informativa, e diz quanto ele retirou. Subtrair de
 * novo aqui tiraria o desconto duas vezes — que e exatamente o tipo de erro
 * que aparece no extrato do cliente, e nao na revisao da tela.
 */

export interface CartSummaryProps {
  quote: CartQuote | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  onCheckout: () => void;
  /** Quantos itens nao entram no total. Zero some da tela. */
  unavailableCount: number;
}

export function CartSummary({
  quote,
  isPending,
  isFetching,
  isError,
  onRetry,
  onCheckout,
  unavailableCount,
}: CartSummaryProps) {
  const subtotalCents = quote?.subtotalCents ?? null;
  const discountCents = quote?.discountTotalCents ?? 0;
  const canCheckout = subtotalCents !== null && subtotalCents > 0;

  return (
    <aside className={styles.summary} aria-label="Resumo do pedido">
      <h2 className={styles.title}>Resumo</h2>

      {isError && subtotalCents === null ? (
        <div className={styles.failed} role="alert">
          <p className={styles.failedText}>
            Nao foi possivel calcular o total agora. Os itens continuam guardados.
          </p>

          <Button variant="secondary" block onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          {/* `aria-busy` enquanto o servidor recalcula: quem ouve a pagina
              fica sabendo que o numero em tela ainda vai mudar. */}
          <dl className={cx(styles.lines, isFetching && styles.recalculating)} aria-busy={isFetching}>
            <Line label="Subtotal" isPending={isPending}>
              {subtotalCents === null ? null : formatCents(subtotalCents)}
            </Line>

            {discountCents > 0 ? (
              <Line label="Desconto por quantidade" tone="discount" isPending={false}>
                -{formatCents(discountCents)}
              </Line>
            ) : null}

            <div className={styles.line}>
              <dt>Frete</dt>
              <dd className={styles.pending}>a calcular</dd>
            </div>

            <div className={cx(styles.line, styles.total)}>
              <dt>Total</dt>
              <dd>
                {isPending || subtotalCents === null ? (
                  <Skeleton variant="text" width="6rem" />
                ) : (
                  <strong className="tabular">{formatCents(subtotalCents)}</strong>
                )}
              </dd>
            </div>
          </dl>

          <p className={styles.note}>
            O frete entra no fechamento do pedido, quando voce escolher a cidade ou a retirada na
            loja.
          </p>

          {unavailableCount > 0 ? (
            <p className={styles.excluded}>
              {unavailableCount === 1
                ? '1 item indisponivel nao entrou nesta conta.'
                : `${String(unavailableCount)} itens indisponiveis nao entraram nesta conta.`}
            </p>
          ) : null}

          <Button block onClick={onCheckout} disabled={!canCheckout}>
            Finalizar compra
          </Button>
        </>
      )}
    </aside>
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
  children: React.ReactNode;
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
