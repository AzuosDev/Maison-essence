/**
 * O tema da interface.
 *
 * Três peças: a lógica sem React (`theme.ts`), o estado compartilhado
 * (`theme-context.tsx`) e os controles (`theme-toggle.tsx` e
 * `theme-icon-button.tsx`). A quarta peça não mora aqui — é o script
 * embutido no `index.html`, que escreve o atributo antes da primeira
 * pintura.
 *
 * Hoje as quatro trabalham para um resultado só: a loja travada no claro.
 * `THEME_CHOICE_VISIBLE` conta a decisão inteira e é o único lugar de
 * desfazê-la.
 */

export {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME_MODE,
  THEME_CHOICE_VISIBLE,
  THEME_COLORS,
  THEME_DESCRIPTIONS,
  THEME_LABELS,
  THEME_MODES,
  THEME_STORAGE_KEY,
  applyTheme,
  initialMode,
  isThemeMode,
  openingMode,
  readStoredMode,
  writeStoredMode,
  type ThemeMode,
} from './theme';

export { ThemeProvider, useTheme } from './theme-context';
export { ThemeIconButton } from './theme-icon-button';
export { ThemeToggle } from './theme-toggle';
