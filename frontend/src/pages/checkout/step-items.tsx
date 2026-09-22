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
 * A lista e a mesma da sacola, na versao compacta — o componente de linha e
 * literalmente o mesmo, `CartLineRow`. Isso nao e economia de codigo: e o
 * que garante que o teto de estoque, o "remover", o estado indisponivel e o
 * que acontece antes da primeira cotacao se comportem aqui exatamente como
 * se comportaram na tela anterior. Uma segunda lista escrita para o checkout
 * divergiria na primeira borda, e as bordas aqui sao quase tudo.
 *
 * Editavel de proposito. Descobrir no checkout que sao dois frascos e nao
 * tres, e ter que voltar para a sacola para corrigir, e uma viagem de ida e
 * volta que custa vendas — e cada alteracao aqui refaz a cotacao pelo
 * servidor, como em qualquer outro lugar.
 *
 * ## O botao que nao deixa passar
 *
 * Com item indisponivel na lista, continuar e impossivel: o servidor
 * recusaria o pedido no fim com `409`, depois de a pessoa ter preenchido
 * endereco, pagamento e telefone. Barrar aqui e devolver trinta segundos de
 * trabalho a quem ia perde-los.
 *
 * Quem decide e `itemsSchema`, e a mesma resposta serve de rotulo: um botao
 * apagado sem explicacao e um beco sem saida, e a frase do esquema diz o que
 * fazer para sair dele. Quais itens sairam e por que, isso esta logo acima,
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
   * Enquanto a primeira cotacao nao chega, a lista de itens cotados esta
   * vazia — e uma sacola vazia e justamente o que o esquema reprova. Por
   * isso o resultado so e consultado depois: durante a espera o botao fica
   * desabilitado por `isPending`, sem a frase "sua sacola esta vazia" na
   * tela de quem tem tres itens nela.
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

      {/* A razao de o botao estar apagado, no lugar onde ele esta. Nao e um
          alerta generico: e o rotulo do impedimento, e some junto com ele. */}
      {blockedBecause === null ? null : (
        <p className={styles.blocked} role="alert">
          {blockedBecause}
        </p>
      )}
    </StepCard>
  );
}

/** O subtotal na linha do celular, logo acima do botao. */
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
