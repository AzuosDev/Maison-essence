import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME_MODE,
  applyTheme,
  readStoredMode,
  resolveTheme,
  writeStoredMode,
  type ResolvedTheme,
  type ThemeMode,
} from './theme';

/**
 * O tema, vivo.
 *
 * Contexto e não um hook solto por um motivo: os três segmentos no rodapé da
 * loja e o botão no pé da coluna do painel precisam mostrar a mesma escolha.
 * Com um hook por componente, cada um teria o próprio estado e os dois
 * sairiam do ar assim que alguém trocasse o tema por um deles.
 */

interface ThemeContextValue {
  /** O que a pessoa escolheu: `system`, `light` ou `dark`. */
  mode: ThemeMode;
  /** O que esta na tela agora. Com `mode: 'system'`, quem decide e o aparelho. */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * A preferência do sistema, acompanhada ao vivo.
 *
 * Lida no inicializador do `useState`, e não num efeito, para que o primeiro
 * render já saia certo — mesmo arranjo do `usePrefersReducedMotion` do
 * carrossel, e pelo mesmo motivo.
 *
 * A guarda de `matchMedia` e para o jsdom dos testes, que não o implementa.
 */
function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia?.(DARK_MEDIA_QUERY).matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.(DARK_MEDIA_QUERY);

    if (!query) {
      return;
    }

    const onChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    query.addEventListener('change', onChange);

    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return prefersDark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /*
   * O estado nasce lendo o armazenamento, e não do padrão.
   *
   * O atributo no `<html>` já foi escrito pelo script do `index.html` antes
   * da primeira pintura. Se este estado comecasse em `system`, o primeiro
   * render do controle marcaria a opção errada e só se corrigiria depois —
   * o segmento marcado pularia debaixo do olho de quem esta olhando para
   * ele.
   */
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode(safeStorage()));

  const systemPrefersDark = useSystemPrefersDark();
  const resolved = resolveTheme(mode, systemPrefersDark);

  /*
   * O documento acompanha o estado.
   *
   * Roda também na montagem, e não só na troca: o script do `index.html` faz
   * o mesmo trabalho antes, e este efeito o refaz com o mesmo resultado. A
   * repetição e barata e paga por si — se o script for removido do HTML por
   * engano, o tema continua funcionando, só com um piscar na abertura.
   *
   * `resolved` esta nas dependências porque a `<meta theme-color>` muda
   * quando o **sistema** vira, mesmo sem ninguém tocar no controle.
   */
  useEffect(() => {
    applyTheme(document.documentElement, mode, resolved);
  }, [mode, resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeStoredMode(safeStorage(), next);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * O tema e quem o troca.
 *
 * Fora do provedor devolve um valor inerte em vez de lançar: o controle e
 * decoração útil, não infraestrutura, e uma tela montada isoladamente num
 * teste — ou um Storybook futuro — não deve quebrar por não ter provedor de
 * tema em volta.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

const FALLBACK: ThemeContextValue = {
  mode: DEFAULT_THEME_MODE,
  resolved: 'light',
  setMode: () => {},
};

/** `localStorage` lança em aba anonima com dados de site bloqueados. */
function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
