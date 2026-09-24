/**
 * O tema da interface: a escolha, onde ela mora e como chega ao documento.
 *
 * Sem React de propósito. Quem precisa desta lógica antes de React existir e
 * o script embutido no `index.html`, que roda antes da primeira pintura para
 * que a página não apareca clara e vire escura meio segundo depois. Aquele
 * script repete estas mesmas três linhas em JavaScript solto — não da para
 * importar um módulo lá sem atrasar a pintura, que e justamente o que ele
 * existe para evitar. O que da para fazer e manter as duas copias com a
 * mesma chave e o mesmo vocabulário, e e o que `theme.spec.ts` verifica.
 */

/**
 * Os três estados, e não dois.
 *
 * `system` não e "o padrão até alguém escolher": e uma escolha própria, e a
 * única que continua acompanhando o sistema depois. Quem esta no escuro
 * porque o celular entra no modo noturno as 19h quer isso — e não "escuro
 * para sempre", que e o que um interruptor de duas posições grava.
 *
 * A diferença entre `system` e os outros dois aparece no CSS: `system` não
 * escreve atributo nenhum, e aí quem decide e a `@media (prefers-color-scheme)`
 * de `tokens.css`.
 */
export const THEME_MODES = ['system', 'light', 'dark'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** O tema que de fato esta na tela, depois de resolver `system`. */
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME_MODE: ThemeMode = 'system';

/**
 * Onde a escolha fica.
 *
 * `localStorage` e não cookie: nada aqui interessa ao servidor, e a loja e um
 * site estático — não há renderização no servidor para a qual mandar a
 * preferência. O prefixo evita colisão com o que mais estiver na origem.
 */
export const THEME_STORAGE_KEY = 'maison.theme';

/** A consulta de midia que decide o `system`. */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * A cor da barra do navegador, por tema.
 *
 * E o `--slab` de cada um: no topo da loja fica a barra de avisos, que e a
 * laje. Com a cor do fundo da página, a emenda entre a barra do navegador e
 * a barra de avisos apareceria como um degrau.
 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#0e0e0e',
  dark: '#16130e',
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

/**
 * A escolha guardada, ou `system` quando não há nenhuma.
 *
 * Tudo dentro de `try`: `localStorage` **lança**, e não devolve `null`, numa
 * aba anonima com cookies bloqueados ou num navegador com dados de site
 * desligados. Sem a guarda, a loja inteira deixaria de montar por causa da
 * preferência de tema.
 */
export function readStoredMode(storage: Pick<Storage, 'getItem'> | undefined): ThemeMode {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);

    return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE;
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

/**
 * Guarda a escolha. `system` apaga a chave em vez de gravar a palavra.
 *
 * Apagar e mais honesto: "sem preferência" e a ausência de registro, e quem
 * olhar o armazenamento depois não fica na dúvida se `system` foi escolhido
 * ou se e o padrão. E, se o padrão mudar um dia, quem nunca escolheu
 * acompanha.
 */
export function writeStoredMode(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
  mode: ThemeMode,
): void {
  try {
    if (mode === DEFAULT_THEME_MODE) {
      storage?.removeItem(THEME_STORAGE_KEY);

      return;
    }

    storage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Armazenamento indisponível. A escolha vale para esta sessão e não
    // sobrevive ao recarregamento — que e melhor que derrubar a página.
  }
}

/** Qual tema esta na tela, dado o modo escolhido e o que o sistema pede. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return mode;
}

/**
 * Leva a escolha ao documento.
 *
 * Duas coisas, e as duas importam:
 *
 * 1. **O atributo `data-theme`.** `system` o remove — e a ausência que
 *    devolve a decisão para a `@media` do CSS. Escrever `data-theme="system"`
 *    não funcionaria: não há seletor para essa palavra em `tokens.css`, e a
 *    página ficaria presa no claro.
 * 2. **A `<meta name="theme-color">`.** E a faixa que o Android pinta em
 *    volta da página e o que o Safari usa na barra de endereço. Sem
 *    atualizar, o tema escuro sai com uma tarja preta do tema claro em cima.
 */
export function applyTheme(
  documentElement: HTMLElement,
  mode: ThemeMode,
  resolved: ResolvedTheme,
): void {
  if (mode === 'system') {
    documentElement.removeAttribute('data-theme');
  } else {
    documentElement.setAttribute('data-theme', mode);
  }

  const meta = documentElement.ownerDocument.querySelector('meta[name="theme-color"]');

  meta?.setAttribute('content', THEME_COLORS[resolved]);
}

/** O rótulo de cada modo, na voz da loja. */
export const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
};

/**
 * O que o leitor de tela ouve em cada opção.
 *
 * O rótulo visível e uma palavra só — e um controle de três segmentos num
 * rodapé, não há espaço para mais. Sozinha, "Sistema" não diz o que faz.
 */
export const THEME_DESCRIPTIONS: Record<ThemeMode, string> = {
  system: 'Tema do sistema: acompanha o aparelho',
  light: 'Tema claro',
  dark: 'Tema escuro',
};
