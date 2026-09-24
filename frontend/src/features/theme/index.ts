/**
 * O tema da interface.
 *
 * Três peças: a lógica sem React (`theme.ts`), o estado compartilhado
 * (`theme-context.tsx`) e os controles (`theme-toggle.tsx` e
 * `theme-icon-button.tsx`). A quarta peça não mora aqui — é o script
 * embutido no `index.html`, que escreve o atributo antes da primeira
 * pintura.
 */

export {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME_MODE,
  THEME_COLORS,
  THEME_DESCRIPTIONS,
  THEME_LABELS,
  THEME_MODES,
  THEME_STORAGE_KEY,
  applyTheme,
  initialMode,
  isThemeMode,
  readStoredMode,
  writeStoredMode,
  type ThemeMode,
} from './theme';

export { ThemeProvider, useTheme } from './theme-context';
export { ThemeIconButton } from './theme-icon-button';
export { ThemeToggle } from './theme-toggle';
