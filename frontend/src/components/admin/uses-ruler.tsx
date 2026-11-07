import { usesRulerOf, usesSentence, type AdminCoupon } from '@/features/admin';
import { cx } from '@/lib/cx';
import styles from './uses-ruler.module.css';

/**
 * Quantos cupons desta campanha já foram, e quantos sobraram.
 *
 * ## Três números, não um
 *
 * `usedCount` sozinho mente. Um pedido em Processando já recebeu o desconto e
 * ainda não foi marcado como vendido: ele não entrou no contador oficial, mas
 * segurou uma vaga que a próxima cliente não tem mais. Um cupom de 50 com 20
 * vendidos e 7 em aberto tem 23 vagas, e não 30 — e e com 30 na cabeça que
 * alguém promete o código a mais dez pessoas.
 *
 * Por isso a barra tem duas fatias cheias, de tons diferentes, e a linha de
 * baixo escreve os três números. O que o olho recebe num relance e "esta
 * quase no fim"; o que a decisão precisa esta escrito.
 *
 * ## A barra não conta nada por conta própria
 *
 * Ela sai inteira do fluxo acessível (`aria-hidden`), e quem ouve a tela
 * recebe a frase de `usesSentence` — que diz mais que "barra de progresso,
 * 54 por cento". A barra e desenho de um dado que já esta escrito ao lado,
 * e não o lugar onde o dado mora.
 *
 * ## Vermelho quando esgota
 *
 * Enquanto sobra vaga a barra e tinta: consumo não e problema, e pintar de
 * dourado faria "gastou metade" parecer conquista. Quando a última vaga vai
 * embora ela vira vermelha, porque ali o cupom deixou de ser desconto e
 * passou a ser recusa no fechamento — e vermelho e a cor do impedimento nesta
 * casa.
 *
 * ## Cupom sem teto não tem barra
 *
 * Fica só a frase. Uma barra que nunca enche seria a tela prometendo um limite
 * que ninguém cadastrou.
 */

export interface UsesRulerProps {
  coupon: AdminCoupon;
  /** `compact` e a versão do cartão: barra fina e uma linha só. */
  variant?: 'compact' | 'full';
  className?: string | undefined;
}

export function UsesRuler({ coupon, variant = 'compact', className }: UsesRulerProps) {
  const ruler = usesRulerOf(coupon);
  const sentence = usesSentence(coupon);
  const exhausted = ruler !== null && ruler.remaining === 0;

  return (
    <div className={cx(styles.ruler, variant === 'full' && styles.full, className)}>
      {ruler === null ? null : (
        <div className={cx(styles.track, exhausted && styles.spent)} aria-hidden="true">
          <span className={styles.used} style={{ width: `${String(ruler.usedPercent)}%` }} />

          {ruler.holdingPercent === 0 ? null : (
            <span
              className={styles.holding}
              style={{ width: `${String(ruler.holdingPercent)}%` }}
            />
          )}
        </div>
      )}

      {/*
        A frase completa fica para quem ouve; quem vê recebe os mesmos números
        repartidos em colunas, com o quadradinho que liga cada um a sua fatia
        da barra. Duas escritas do mesmo dado, e não dois dados.
      */}
      <span className="visually-hidden">{sentence}</span>

      <p className={styles.legend} aria-hidden="true">
        <span className={styles.item}>
          <span className={cx(styles.swatch, exhausted && styles.swatchSpent)} />
          <strong className={cx(styles.number, 'tabular')}>{coupon.usedCount}</strong>
          {coupon.usedCount === 1 ? 'vendido' : 'vendidos'}
        </span>

        {coupon.holdingCount === 0 ? null : (
          <span className={styles.item}>
            <span
              className={cx(styles.swatch, styles.swatchHolding, exhausted && styles.swatchSpent)}
            />
            <strong className={cx(styles.number, 'tabular')}>{coupon.holdingCount}</strong>
            {coupon.holdingCount === 1 ? 'em pedido aberto' : 'em pedidos abertos'}
          </span>
        )}

        <span className={styles.item}>
          {coupon.maxUses === null ? (
            <span className={styles.open}>sem limite de usos</span>
          ) : (
            <>
              <span className={cx(styles.swatch, styles.swatchFree)} />
              <strong className={cx(styles.number, 'tabular')}>{coupon.remainingUses ?? 0}</strong>
              {`de ${String(coupon.maxUses)} ${(coupon.remainingUses ?? 0) === 1 ? 'disponível' : 'disponíveis'}`}
            </>
          )}
        </span>
      </p>
    </div>
  );
}
