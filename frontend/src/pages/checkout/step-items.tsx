import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { CartLineRow, CartNotices } from '@/components/store';
import { Skeleton } from '@/components/ui';
import { lineKey, useCart } from '@/features/cart';
import { itemsSchema, type CheckoutQuoteView } from '@/features/checkout';
import { formatCents } from '@/lib/format';
import { StepCard } from './step-card';
import styles from './step-items.module.css';

/**
 * Etapa 1: o que vai no pedido.
 *
 * A lista e a mesma da sacola, na versão compacta — o componente de linha e
 * literalmente o mesmo, `CartLineRow`. Isso não e economia de código: e o
 * que garante que o teto de estoque, o "remover", o estado indisponível e o
 * que acontece antes da primeira cotação se comportem aqui exatamente como
 * se comportaram na tela anterior. Uma segunda lista escrita para o checkout
 * divergiria na primeira borda, e as bordas aqui são quase tudo.
 *
 * Editável de propósito. Descobrir no checkout que são dois frascos e não
 * três, e ter que voltar para a sacola para corrigir, e uma viagem de ida e
 * volta que custa vendas — e cada alteração aqui refaz a cotação pelo
 * servidor, como em qualquer outro lugar.
 *
 * ## O botão que não deixa passar
 *
 * Com item indisponível na lista, continuar e impossível: o servidor
 * recusaria o pedido no fim com `409`, depois de a pessoa ter preenchido
 * endereço, pagamento e telefone. Barrar aqui e devolver trinta segundos de
 * trabalho a quem ia perde-los.
 *
 * Quem decide e `itemsSchema`, e a mesma resposta serve de rótulo: um botão
 * apagado sem explicação e um beco sem saída, e a frase do esquema diz o que
 * fazer para sair dele. Quais itens saíram e por que, isso esta logo acima,
 * em `CartNotices`, nas palavras que o servidor escreveu.
 */

export interface StepItemsProps {
  quoting: CheckoutQuoteView;
  focusOnMount: boolean;
  onContinue: () => void;
}

export function StepItems({ quoting, focusOnMount, onContinue }: StepItemsProps) {
  const lines = useCart((state) => state.lines);
  const hints = useCart((state) => state.hints);

  const { quote, isPending } = quoting;

  /**
   * A regra da etapa, aplicada ao que o servidor respondeu.
   *
   * Enquanto a primeira cotação não chega, a lista de itens cotados esta
   * vazia — e uma sacola vazia e justamente o que o esquema reprova. Por
   * isso o resultado só e consultado depois: durante a espera o botão fica
   * desabilitado por `isPending`, sem a frase "sua sacola esta vazia" na
   * tela de quem tem três itens nela.
   */
  const gate = itemsSchema.safeParse({ items: quote?.items ?? [] });
  const blockedBecause = isPending || gate.success ? null : gate.error.issues[0]?.message;

  const byKey = new Map(quote?.items.map((item) => [lineKey(item.productId, item.variantId), item]));

  return (
    <StepCard
      title="Seus itens"
      description="Confira o que vai no pedido. Da para ajustar a quantidade ou tirar um item aqui mesmo."
      focusOnMount={focusOnMount}
      actionLabel="Continuar"
      actionDisabled={blockedBecause !== null || isPending}
      onAction={onContinue}
      total={<Subtotal quoting={quoting} />}
    >
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
              compact
            />
          );
        })}
      </ul>

      <div className={styles.foot}>
        <div className={styles.subtotal}>
          <span>Subtotal</span>

          {isPending || quote === undefined ? (
            <Skeleton variant="text" width="5rem" />
          ) : (
            <strong className="tabular">{formatCents(quote.subtotalCents)}</strong>
          )}
        </div>

        <Link to={ROUTES.products} className={styles.keepShopping}>
          Continuar comprando
        </Link>
      </div>

      {/* A razão de o botão estar apagado, no lugar onde ele esta. Não e um
          alerta generico: e o rótulo do impedimento, e some junto com ele. */}
      {blockedBecause === null ? null : (
        <p className={styles.blocked} role="alert">
          {blockedBecause}
        </p>
      )}
    </StepCard>
  );
}

/** O subtotal na linha do celular, logo acima do botão. */
function Subtotal({ quoting }: { quoting: CheckoutQuoteView }) {
  return (
    <>
      <span>Subtotal</span>

      {quoting.isPending || quoting.quote === undefined ? (
        <Skeleton variant="text" width="5rem" />
      ) : (
        <strong className="tabular">{formatCents(quoting.quote.subtotalCents)}</strong>
      )}
    </>
  );
}
