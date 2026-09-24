import { cx } from '@/lib/cx';
import { THEME_LABELS, type ThemeMode } from './theme';
import { MoonIcon, SunIcon } from './theme-icons';
import { useTheme } from './theme-context';
import styles from './theme-icon-button.module.css';

const ICONS: Record<ThemeMode, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
};

/** O outro dos dois. */
function nextMode(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * O tema em um alvo só: o cabeçalho da loja e o pé da coluna do painel.
 *
 * ## Por que aqui ele alterna, e no rodapé são dois botões
 *
 * São dois momentos diferentes. O rodapé da loja tem largura para as opções à
 * vista, e é lá que alguém **descobre** que há uma escolha. Nos dois lugares
 * deste botão não cabem dois rótulos, e nem deveriam: no cabeçalho o espaço é
 * de um alvo de 44px ao lado da sacola, e na coluna do painel a pílula de
 * segmentos passava dos 15rem da coluna e punha uma barra de rolagem
 * horizontal debaixo do menu. Quem clica nos dois já sabe o que quer e quer
 * um toque — no painel, ainda por cima, é a mesma pessoa todo dia.
 *
 * A objeção conhecida a um botão que troca sozinho é não dizer para onde vai.
 * Aqui ela está respondida de duas formas: o `title` e o nome acessível dizem
 * o estado atual **e** o próximo — "Tema: claro. Trocar para escuro" —, e com
 * duas paradas o toque seguinte sempre desfaz o anterior.
 *
 * ## O que o ícone mostra
 *
 * O tema que está na tela: o sol no claro, a lua no escuro.
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
