import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { CartEmpty, CartLineRow, CartNotices } from '@/components/store';
import { Breadcrumb, Container } from '@/components/ui';
import { lineKey, useCart, useCartQuote } from '@/features/cart';
import { usePageMeta } from '@/lib/use-page-meta';
import { CartSummary } from './cart-summary';
import styles from './cart-page.module.css';

/**
 * `/sacola`: a sacola inteira.
 *
 * A gaveta responde "entrou mesmo?"; esta página responde "e agora?". E onde
 * se confere o que vai junto, se ajusta a quantidade com calma e se lê o que
 * mudou desde a última visita — e onde cabe a lista de dez itens que não
 * caberia numa gaveta de 26rem.
 *
 * ## Três blocos
 *
 * Lista a esquerda, resumo a direita, e no celular um embaixo do outro, nesta
 * ordem: o cliente confere o que esta levando antes de olhar o total, que e a
 * ordem em que ele faria isso com a sacola na mão.
 *
 * ## Fora do índice
 *
 * A sacola e de uma pessoa só e não tem nada a dizer a quem chega pelo
 * Google. O `robots` com `noindex` evita que o endereço entre no índice —
 * mesmo vazio, que e como o rastreador sempre a encontraria.
 */
export default function CartPage() {
  const lines = useCart((state) => state.lines);
  const hints = useCart((state) => state.hints);
  const navigate = useNavigate();

  const quoting = useCartQuote();
  const { quote } = quoting;

  usePageMeta({
    title: 'Sua sacola — Maison Essence',
    description: 'Os itens que você separou na Maison Essence.',
    robots: 'noindex',
  });

  const byKey = new Map(quote?.items.map((item) => [lineKey(item.productId, item.variantId), item]));

  return (
    <Container className={styles.page}>
      <Breadcrumb
        items={[{ label: 'Início', to: ROUTES.home }, { label: 'Sacola' }]}
        className={styles.breadcrumb}
      />

      <h1 className={styles.heading}>Sua sacola</h1>

      {lines.length === 0 ? (
        <CartEmpty />
      ) : (
        <div className={styles.body}>
          <section className={styles.items} aria-label="Itens da sacola">
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
                    line={line}
                    quote={byKey.get(key) ?? null}
                    hint={hints[key] ?? null}
                  />
                );
              })}
            </ul>
          </section>

          <CartSummary
            quote={quote}
            isPending={quoting.isPending}
            isFetching={quoting.isFetching}
            isError={quoting.isError}
            onRetry={quoting.refetch}
            unavailableCount={quoting.unavailable.length}
            onCheckout={() => {
              void navigate(ROUTES.checkout);
            }}
          />
        </div>
      )}
    </Container>
  );
}
