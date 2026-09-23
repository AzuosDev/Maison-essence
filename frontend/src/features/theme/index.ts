/**
 * O tema da interface.
 *
 * Tres pecas: a logica sem React (`theme.ts`), o estado compartilhado
 * (`theme-context.tsx`) e o controle (`theme-toggle.tsx`). A quarta peca nao
 * mora aqui — e o script embutido no `index.html`, que escreve o atributo
 * antes da primeira pintura.
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
  isThemeMode,
  readStoredMode,
  resolveTheme,
  writeStoredMode,
  type ResolvedTheme,
  type ThemeMode,
} from './theme';

export { ThemeProvider, useTheme } from './theme-context';
export { ThemeIconButton } from './theme-icon-button';
export { ThemeToggle } from './theme-toggle';
