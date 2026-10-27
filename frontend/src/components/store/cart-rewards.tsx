import { useStoreSettings } from '@/features/settings';
import { formatCents } from '@/lib/format';
import { cx } from '@/lib/cx';
import { GIFT } from './store.constants';
import styles from './cart-rewards.module.css';

/**
 * Quanto falta para o próximo benefício da sacola.
 *
 * Dois degraus, nesta ordem: frete grátis e brinde. O cliente vê **um** por
 * vez — o próximo que ele ainda não alcancou —, e não os dois: uma sacola
 * com duas barras de progresso lado a lado vira um painel de metas, e quem
 * esta comprando perfume não veio jogar.
 *
 * Quando os dois já foram alcancados, a régua vira a confirmação do último.
 * Ela não some: "frete grátis liberado" e exatamente o que faz a pessoa
 * fechar o pedido em vez de deixar a sacola para amanhã.
 *
 * ## De onde vem cada degrau
 *
 * O frete grátis sai de `GET /settings` (`freeShippingMinCents`), que a dona
 * edita no painel — e e `null` quando ela desliga a regra. O brinde sai de
 * uma constante revisada (ver `GIFT` em `store.constants`), porque a API
 * ainda não tem campo para ele; nasce desligado, e com ele desligado este
 * componente simplesmente não desenha o degrau.
 *
 * Sem nenhum dos dois configurados, não há régua nenhuma e o componente não
 * ocupa espaço — que e o caso de uma loja que não trabalha com faixa de
 * benefício.
 *
 * ## Por que o subtotal vem de fora
 *
 * Quem calcula valor nesta loja e o servidor (`POST /cart/quote`). Este
 * componente recebe o número já cotado e não soma nada: uma régua que
 * contasse por conta própria poderia anunciar "frete grátis liberado" sobre
 * um total que o checkout vai recalcular para menos.
 */
interface CartRewardsProps {
  /** O subtotal cotado pelo servidor, em centavos. `null` enquanto cota. */
  subtotalCents: number | null;
  className?: string | undefined;
}

interface Step {
  minCents: number;
  /** O que se ganha ao chegar lá. */
  prize: string;
  /** A confirmação, quando já chegou. */
  reached: string;
}

export function CartRewards({ subtotalCents, className }: CartRewardsProps) {
  const { settings } = useStoreSettings();

  const steps: Step[] = [];
  const freeShipping = settings?.freeShippingMinCents ?? null;

  if (freeShipping !== null && freeShipping > 0) {
    steps.push({
      minCents: freeShipping,
      prize: 'frete grátis',
      reached: 'Frete grátis liberado neste pedido.',
    });
  }

  if (GIFT.minCents > 0 && GIFT.label !== '') {
    steps.push({
      minCents: GIFT.minCents,
      prize: GIFT.label,
      reached: `Brinde liberado: ${GIFT.label}.`,
    });
  }

  if (steps.length === 0 || subtotalCents === null) {
    return null;
  }

  const ordered = steps.toSorted((a, b) => a.minCents - b.minCents);
  const next = ordered.find((step) => subtotalCents < step.minCents);

  // Tudo alcancado: a régua confirma o último degrau e para de pedir mais.
  if (next === undefined) {
    const last = ordered[ordered.length - 1];

    return last === undefined ? null : (
      <div className={cx(styles.rewards, styles.done, className)}>
        <p className={styles.message}>{last.reached}</p>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.fill} />
        </span>
      </div>
    );
  }

  const missing = next.minCents - subtotalCents;

  /*
   * A barra começa do degrau anterior, e não do zero.
   *
   * Com dois degraus — frete grátis em R$ 150 e brinde em R$ 300 —, uma
   * sacola de R$ 160 mostraria a barra em 53% rumo ao brinde, e o cliente
   * que acabou de passar do frete grátis veria o progresso dele encolher.
   * Medindo do degrau anterior, ele vê 6%: o começo de uma corrida nova.
   */
  const previous = ordered.findLast((step) => step.minCents <= subtotalCents);
  const floor = previous?.minCents ?? 0;
  const span = next.minCents - floor;
  const percent = span <= 0 ? 0 : Math.min(100, Math.round(((subtotalCents - floor) / span) * 100));

  return (
    <div className={cx(styles.rewards, className)}>
      {/*
        `aria-live` educado: a frase muda sozinha a cada item adicionado, e
        quem usa leitor de tela merece saber que faltam vinte reais — mas não
        a ponto de interromper a leitura da linha que ele acabou de mudar.
      */}
      <p className={styles.message} aria-live="polite">
        Faltam <strong className="tabular">{formatCents(missing)}</strong> para {next.prize}.
      </p>

      <span className={styles.track} aria-hidden="true">
        {/* `scaleX`, e não `width`: ver o comentário na folha. O fator vai
            com três casas porque 0.06 e 0.065 são barras visivelmente
            diferentes num trilho de 300px. */}
        <span
          className={styles.fill}
          style={{ transform: `scaleX(${(percent / 100).toFixed(3)})` }}
        />
      </span>
    </div>
  );
}
