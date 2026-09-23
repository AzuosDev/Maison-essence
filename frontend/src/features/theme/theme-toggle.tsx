import { useId } from 'react';
import { cx } from '@/lib/cx';
import { useTheme } from './theme-context';
import { THEME_DESCRIPTIONS, THEME_LABELS, THEME_MODES } from './theme';
import styles from './theme-toggle.module.css';

interface ThemeToggleProps {
  /**
   * Em que fundo o controle caiu.
   *
   * `slab` e o padrao porque o lugar principal dele e o rodape, que e a laje
   * escura. Mesmo arranjo do `NewsletterForm` e do `TrustBadges`, que moram
   * no mesmo lugar: quem sabe em que fundo o componente caiu e quem o
   * coloca, nao ele.
   */
  tone?: 'slab' | 'page';
  className?: string | undefined;
}

/**
 * A escolha de tema: sistema, claro, escuro.
 *
 * ## Por que tres botoes, e nao um interruptor
 *
 * Um interruptor de duas posicoes obriga a escolher entre claro e escuro
 * **para sempre**, e perde o caso mais comum: o aparelho que vira sozinho a
 * noite. Quem esta nesse caso nao quer "escuro", quer "o que o celular
 * estiver". Com duas posicoes, a unica forma de voltar a acompanhar o
 * aparelho seria limpar os dados do site.
 *
 * Tres tambem resolve o problema de um interruptor de tres estados, que e
 * nao dizer para onde vai no proximo toque. Aqui as tres opcoes estao a
 * vista e cada uma e um destino, nao um passo.
 *
 * ## Por que radio, e nao botao
 *
 * Sao tres opcoes mutuamente exclusivas de um mesmo assunto, que e a
 * definicao de grupo de radio. De graca vem o que seria trabalhoso repetir a
 * mao: as setas do teclado andam entre as opcoes, o Tab entra e sai do grupo
 * de uma vez, e o leitor de tela anuncia "2 de 3" sem que nada aqui precise
 * dizer isso.
 *
 * Os radios de verdade ficam invisiveis mas presentes — `opacity: 0` e nao
 * `display: none`, que os tiraria da ordem de foco. O que se ve e o
 * `<label>` de cada um.
 */
export function ThemeToggle({ tone = 'slab', className }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();
  const name = useId();

  return (
    <fieldset className={cx(styles.group, tone === 'page' && styles.page, className)}>
      {/*
        `legend` de verdade, e nao um `aria-label` no fieldset: o rotulo
        precisa ser visivel. Sem ele, tres palavras soltas no pe da pagina
        nao dizem do que sao — "Claro" e "Escuro" ali poderiam ser qualquer
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
