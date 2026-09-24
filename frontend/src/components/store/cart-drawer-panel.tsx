import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button, Drawer, Skeleton } from '@/components/ui';
import { lineKey, useCart, useCartQuote } from '@/features/cart';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import { CartEmpty } from './cart-empty';
import { CartLineRow } from './cart-line-row';
import { CartNotices } from './cart-notices';
import styles from './cart-drawer.module.css';

/**
 * O miolo da gaveta da sacola.
 *
 * Separado de `cart-drawer.tsx` por peso, e nao por organizacao. A moldura
 * da loja importa a gaveta, e tudo o que a gaveta importar de forma estatica
 * entra no pedaco inicial: a lista, o resumo, a cotacao, o vazio com a
 * ilustracao. Sao doze kilobytes que toda visita baixaria — inclusive a de
 * quem abriu a home para ver um perfume e nunca clicou em "adicionar".
 *
 * Aqui eles viram um pedido separado, feito na primeira vez que a gaveta
 * abre. O atraso e o de um arquivo pequeno ja em cache de borda, e ele
 * acontece por tras da animacao de entrada; o toast de confirmacao ja esta
 * na tela nesse meio tempo.
 */
export function CartDrawerPanel() {
  const lines = useCart((state) => state.lines);
  const hints = useCart((state) => state.hints);
  const close = useCart((state) => state.closeDrawer);
  const navigate = useNavigate();

  const quoting = useCartQuote();
  const { quote } = quoting;

  const byKey = new Map(
    quote?.items.map((item) => [lineKey(item.productId, item.variantId), item]),
  );
  const isEmpty = lines.length === 0;

  const goToCheckout = (): void => {
    close();
    void navigate(ROUTES.checkout);
  };

  return (
    <Drawer
      open
      onClose={close}
      title="Sua sacola"
      side="right"
      closeLabel="Fechar a sacola"
      footer={
        isEmpty ? null : (
          <>
            <Summary
              subtotalCents={quote?.subtotalCents ?? null}
              discountCents={quote?.discountTotalCents ?? 0}
              isPending={quoting.isPending}
              isFetching={quoting.isFetching}
              isError={quoting.isError}
              onRetry={quoting.refetch}
            />

            {/*
              Dois botoes, e so dois: fechar o pedido e voltar a comprar.
              Sao as duas coisas que alguem faz depois de adicionar um item,
              e dar a elas o mesmo peso de um terceiro botao apagaria a
              hierarquia — tres botoes empilhados viram uma lista de opcoes
              que precisa ser lida inteira para escolher.

              "Ver a sacola" e um link de texto abaixo deles. E um destino,
              nao uma decisao, e quem quer a lista inteira e a minoria: a
              gaveta ja mostra os itens e o total.
            */}
            <div className={styles.actions}>
              <Button
                block
                onClick={goToCheckout}
                disabled={quote === undefined || quote.subtotalCents <= 0}
              >
                Finalizar compra
              </Button>

              <Button variant="secondary" block onClick={close}>
                Continuar comprando
              </Button>

              <Link to={ROUTES.cart} className={styles.cartLink} onClick={close}>
                Ver a sacola inteira
              </Link>
            </div>
          </>
        )
      }
    >
      {isEmpty ? (
        <CartEmpty compact onNavigate={close} />
      ) : (
        <>
          <CartNotices
            unavailable={quoting.unavailable}
            pricesChanged={quoting.pricesChanged}
            onDismissPrices={quoting.dismissPriceNotice}
          />

          <ul className={styles.lines}>
            {lines.map((line) => {
              const key = lineKey(line.productId, line.variantId);

              return (
                <CartLineRow
                  key={key}
                  compact
                  line={line}
                  quote={byKey.get(key) ?? null}
                  hint={hints[key] ?? null}
                />
              );
            })}
          </ul>
        </>
      )}
    </Drawer>
  );
}

/* ---- O resumo do rodape ------------------------------------------------- */

interface SummaryProps {
  subtotalCents: number | null;
  discountCents: number;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
}

function Summary({
  subtotalCents,
  discountCents,
  isPending,
  isFetching,
  isError,
  onRetry,
}: SummaryProps) {
  // Erro com um total anterior na tela nao vira tela de erro: o numero que
  // esta ali continua valendo mais que um aviso, e a proxima mexida tenta de
  // novo sozinha.
  if (isError && subtotalCents === null) {
    return (
      <div className={styles.failed} role="alert">
        <p className={styles.failedText}>Não foi possível calcular o total agora.</p>

        <button type="button" className={styles.retry} onClick={onRetry}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    // `aria-busy` enquanto o servidor recalcula: quem ouve a pagina fica
    // sabendo que o numero em tela ainda vai mudar.
    <div className={cx(styles.summary, isFetching && styles.recalculating)} aria-busy={isFetching}>
      {discountCents > 0 ? (
        <p className={styles.line}>
          <span>Desconto por quantidade</span>
          <strong className={cx(styles.discount, 'tabular')}>-{formatCents(discountCents)}</strong>
        </p>
      ) : null}

      <p className={cx(styles.line, styles.total)}>
        <span>Subtotal</span>

        {isPending || subtotalCents === null ? (
          <Skeleton variant="text" width="5rem" />
        ) : (
          <strong className="tabular">{formatCents(subtotalCents)}</strong>
        )}
      </p>

      <p className={styles.shipping}>Frete calculado no fechamento do pedido.</p>
    </div>
  );
}
