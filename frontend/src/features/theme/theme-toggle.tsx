import { useId } from 'react';
import { cx } from '@/lib/cx';
import { useTheme } from './theme-context';
import { THEME_DESCRIPTIONS, THEME_LABELS, THEME_MODES } from './theme';
import styles from './theme-toggle.module.css';

interface ThemeToggleProps {
  /**
   * Em que fundo o controle caiu.
   *
   * `slab` é o padrão porque o lugar principal dele é o rodapé, que é a laje
   * escura. Mesmo arranjo do `NewsletterForm` e do `TrustBadges`, que moram
   * no mesmo lugar: quem sabe em que fundo o componente caiu é quem o
   * coloca, não ele.
   */
  tone?: 'slab' | 'page';
  className?: string | undefined;
}

/**
 * A escolha de tema: claro ou escuro.
 *
 * ## Por que dois botões, e não um interruptor
 *
 * As duas opções ficam à vista e cada uma é um destino, não um passo. Um
 * interruptor de duas posições mostra um estado e esconde o outro, e quem
 * chega precisa deduzir se a peça acesa é o tema atual ou o que vai acontecer
 * se ela for tocada. Com dois segmentos e um deles marcado, não há o que
 * deduzir.
 *
 * ## Por que radio, e não botão
 *
 * São opções mutuamente exclusivas de um mesmo assunto, que é a definição de
 * grupo de radio. De graça vem o que seria trabalhoso repetir à mão: as setas
 * do teclado andam entre as opções, o Tab entra e sai do grupo de uma vez, e
 * o leitor de tela anuncia "2 de 2" sem que nada aqui precise dizer isso.
 *
 * Os radios de verdade ficam invisíveis mas presentes — `opacity: 0` e não
 * `display: none`, que os tiraria da ordem de foco. O que se vê é o
 * `<label>` de cada um.
 */
export function ThemeToggle({ tone = 'slab', className }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();
  const name = useId();

  return (
    <fieldset className={cx(styles.group, tone === 'page' && styles.page, className)}>
      {/*
        `legend` de verdade, e não um `aria-label` no fieldset: o rótulo
        precisa ser visível. Sem ele, duas palavras soltas no pé da página
        não dizem do que são — "Claro" e "Escuro" ali poderiam ser qualquer
        coisa.
      */}
      <legend className={styles.legend}>Tema</legend>

      <div className={styles.options}>
        {THEME_MODES.map((option) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={mode === option}
              onChange={() => {
                setMode(option);
              }}
              className={styles.input}
              aria-label={THEME_DESCRIPTIONS[option]}
            />

            <span className={styles.face}>{THEME_LABELS[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
