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

/** O próximo da roda: sistema, claro, escuro e de volta ao sistema. */
function nextMode(current: ThemeMode): ThemeMode {
  const position = THEME_MODES.indexOf(current);

  return THEME_MODES[(position + 1) % THEME_MODES.length] ?? 'system';
}

/**
 * O tema em um alvo só: o cabeçalho da loja e o pé da coluna do painel.
 *
 * ## Por que aqui ele gira, e no rodapé são três botões
 *
 * São dois momentos diferentes. O rodapé da loja tem largura para as três
 * opções a vista, e e lá que alguém **descobre** que há uma escolha. Nos dois
 * lugares deste botão não cabem três rótulos, e nem deveriam: no cabeçalho o
 * espaço e de um alvo de 44px ao lado da sacola, e na coluna do painel a
 * pílula de três segmentos passava dos 15rem da coluna e punha uma barra de
 * rolagem horizontal debaixo do menu. Quem clica nos dois já sabe o que quer
 * e quer um toque — no painel, ainda por cima, e a mesma pessoa todo dia.
 *
 * A objeção conhecida a um botão que gira e não dizer para onde vai. Aqui
 * ela esta respondida de duas formas: o `title` e o nome acessível dizem o
 * estado atual **e** o próximo — "Tema: sistema. Trocar para claro" —, e a
 * roda tem só três paradas, então o pior caso para voltar são dois toques.
 *
 * ## O que o ícone mostra
 *
 * O **modo escolhido**, e não o tema que esta na tela. Com `system` a
 * escolher, o ícone e a tela do aparelho — e não o sol, mesmo que o sol seja
 * o que se vê. Mostrar o resultado esconderia justamente a informação que o
 * botão existe para dar: se a loja esta acompanhando o aparelho ou não.
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
