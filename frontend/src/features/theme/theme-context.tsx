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
  initialMode,
  writeStoredMode,
  type ThemeMode,
} from './theme';

/**
 * O tema, vivo.
 *
 * Contexto e não um hook solto por um motivo: os segmentos no rodapé da loja
 * e o botão no pé da coluna do painel precisam mostrar a mesma escolha. Com
 * um hook por componente, cada um teria o próprio estado e os dois sairiam do
 * ar assim que alguém trocasse o tema por um deles.
 */

interface ThemeContextValue {
  /** O que está na tela: `light` ou `dark`. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * A preferência do aparelho, perguntada uma vez.
 *
 * Uma vez e não ao vivo: sem o modo `system`, o aparelho decide com que tema
 * a loja abre para quem nunca escolheu, e para por aí. Continuar ouvindo a
 * `@media` viraria a loja debaixo do olho de quem está lendo quando o celular
 * entra no modo noturno — e sem nenhuma opção marcada que explicasse por quê.
 *
 * A guarda de `matchMedia` é para o jsdom dos testes, que não o implementa.
 */
function systemPrefersDark(): boolean {
  return window.matchMedia?.(DARK_MEDIA_QUERY).matches ?? false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /*
   * O estado nasce lendo o armazenamento, e não de um padrão.
   *
   * O atributo no `<html>` já foi escrito pelo script do `index.html` antes
   * da primeira pintura, com esta mesma regra. Se este estado começasse no
   * claro, o primeiro render do controle marcaria a opção errada e só se
   * corrigiria depois — o segmento marcado pularia debaixo do olho de quem
   * está olhando para ele.
   */
  const [mode, setModeState] = useState<ThemeMode>(() =>
    initialMode(safeStorage(), systemPrefersDark()),
  );

  /*
   * O documento acompanha o estado.
   *
   * Roda também na montagem, e não só na troca: o script do `index.html` faz
   * o mesmo trabalho antes, e este efeito o refaz com o mesmo resultado. A
   * repetição é barata e paga por si — se o script for removido do HTML por
   * engano, o tema continua funcionando, só com um piscar na abertura.
   */
  useEffect(() => {
    applyTheme(document.documentElement, mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeStoredMode(safeStorage(), next);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * O tema e quem o troca.
 *
 * Fora do provedor devolve um valor inerte em vez de lançar: o controle é
 * decoração útil, não infraestrutura, e uma tela montada isoladamente num
 * teste — ou um Storybook futuro — não deve quebrar por não ter provedor de
 * tema em volta.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

const FALLBACK: ThemeContextValue = {
  mode: DEFAULT_THEME_MODE,
  setMode: () => {},
};

/** `localStorage` lança em aba anônima com dados de site bloqueados. */
function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
