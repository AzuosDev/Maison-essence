import { useId } from 'react';
import { cx } from '@/lib/cx';
import { useTheme } from './theme-context';
import { THEME_DESCRIPTIONS, THEME_LABELS, THEME_MODES } from './theme';
import styles from './theme-toggle.module.css';

interface ThemeToggleProps {
  /**
   * Em que fundo o controle caiu.
   *
   * `slab` e o padrão porque o lugar principal dele e o rodapé, que e a laje
   * escura. Mesmo arranjo do `NewsletterForm` e do `TrustBadges`, que moram
   * no mesmo lugar: quem sabe em que fundo o componente caiu e quem o
   * coloca, não ele.
   */
  tone?: 'slab' | 'page';
  className?: string | undefined;
}

/**
 * A escolha de tema: sistema, claro, escuro.
 *
 * ## Por que três botões, e não um interruptor
 *
 * Um interruptor de duas posições obriga a escolher entre claro e escuro
 * **para sempre**, e perde o caso mais comum: o aparelho que vira sozinho a
 * noite. Quem esta nesse caso não quer "escuro", quer "o que o celular
 * estiver". Com duas posições, a única forma de voltar a acompanhar o
 * aparelho seria limpar os dados do site.
 *
 * Três também resolve o problema de um interruptor de três estados, que e
 * não dizer para onde vai no próximo toque. Aqui as três opções estão a
 * vista e cada uma e um destino, não um passo.
 *
 * ## Por que radio, e não botão
 *
 * São três opções mutuamente exclusivas de um mesmo assunto, que e a
 * definição de grupo de radio. De graça vem o que seria trabalhoso repetir a
 * mão: as setas do teclado andam entre as opções, o Tab entra e sai do grupo
 * de uma vez, e o leitor de tela anuncia "2 de 3" sem que nada aqui precise
 * dizer isso.
 *
 * Os radios de verdade ficam invisíveis mas presentes — `opacity: 0` e não
 * `display: none`, que os tiraria da ordem de foco. O que se vê e o
 * `<label>` de cada um.
 */
export function ThemeToggle({ tone = 'slab', className }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();
  const name = useId();

  return (
    <fieldset className={cx(styles.group, tone === 'page' && styles.page, className)}>
      {/*
        `legend` de verdade, e não um `aria-label` no fieldset: o rótulo
        precisa ser visível. Sem ele, três palavras soltas no pé da página
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
