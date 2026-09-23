import { cx } from '@/lib/cx';
import { THEME_LABELS, THEME_MODES, type ThemeMode } from './theme';
import { MonitorIcon, MoonIcon, SunIcon } from './theme-icons';
import { useTheme } from './theme-context';
import styles from './theme-icon-button.module.css';

const ICONS: Record<ThemeMode, typeof SunIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

/** O proximo da roda: sistema, claro, escuro e de volta ao sistema. */
function nextMode(current: ThemeMode): ThemeMode {
  const position = THEME_MODES.indexOf(current);

  return THEME_MODES[(position + 1) % THEME_MODES.length] ?? 'system';
}

/**
 * O tema no cabecalho, ao lado da sacola.
 *
 * ## Por que aqui ele gira, e no rodape sao tres botoes
 *
 * Sao dois lugares e dois momentos. No cabecalho o espaco e de um alvo de
 * 44px ao lado da sacola — nao cabem tres rotulos, e nem deveriam: quem
 * clica aqui ja sabe o que quer e quer um toque. No rodape ha largura para
 * as tres opcoes a vista, e e la que alguem **descobre** que ha uma escolha.
 *
 * A objecao conhecida a um botao que gira e nao dizer para onde vai. Aqui
 * ela esta respondida de duas formas: o `title` e o nome acessivel dizem o
 * estado atual **e** o proximo — "Tema: sistema. Trocar para claro" —, e a
 * roda tem so tres paradas, entao o pior caso para voltar sao dois toques.
 *
 * ## O que o icone mostra
 *
 * O **modo escolhido**, e nao o tema que esta na tela. Com `system` a
 * escolher, o icone e a tela do aparelho — e nao o sol, mesmo que o sol seja
 * o que se ve. Mostrar o resultado esconderia justamente a informacao que o
 * botao existe para dar: se a loja esta acompanhando o aparelho ou nao.
 */
export function ThemeIconButton({ className }: { className?: string | undefined }) {
  const { mode, setMode } = useTheme();

  const CurrentIcon = ICONS[mode];
  const next = nextMode(mode);
  const label = `Tema: ${THEME_LABELS[mode].toLowerCase()}. Trocar para ${THEME_LABELS[
    next
  ].toLowerCase()}`;

  return (
    <button
      type="button"
      className={cx(styles.button, className)}
      onClick={() => {
        setMode(next);
      }}
      aria-label={label}
      title={label}
    >
      <CurrentIcon />
    </button>
  );
}
