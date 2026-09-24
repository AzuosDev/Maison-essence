/**
 * O tema da interface: a escolha, onde ela mora e como chega ao documento.
 *
 * Sem React de propósito. Quem precisa desta lógica antes de React existir é
 * o script embutido no `index.html`, que roda antes da primeira pintura para
 * que a página não apareça clara e vire escura meio segundo depois. Aquele
 * script repete estas mesmas linhas em JavaScript solto — não dá para
 * importar um módulo lá sem atrasar a pintura, que é justamente o que ele
 * existe para evitar. O que dá para fazer é manter as duas cópias com a
 * mesma chave e o mesmo vocabulário, e é o que `theme.spec.ts` verifica.
 */

/**
 * Dois estados, e não três.
 *
 * Havia um terceiro, `system`, que era uma escolha própria: continuava
 * acompanhando o aparelho depois de escolhida. Foi retirado a pedido do dono
 * da loja, junto do ícone de monitor que o representava.
 *
 * O aparelho não sumiu da história, só deixou de ser um destino: `initialMode`
 * pergunta ao `prefers-color-scheme` para decidir com que tema a loja abre
 * para quem nunca escolheu. A diferença é que agora essa consulta acontece uma
 * vez e vira uma das duas palavras — antes ela valia para sempre, e a loja
 * virava junto com o celular às 19h. Quem quiser isso de volta escolhe escuro
 * à noite na mão.
 */
export const THEME_MODES = ['light', 'dark'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/**
 * O tema de quem não escolheu e cujo aparelho não respondeu.
 *
 * Acontece quando `matchMedia` não existe (o jsdom dos testes) ou quando o
 * armazenamento lança antes de qualquer leitura. Claro porque é o `:root` de
 * `tokens.css`, o que a loja mostra sem nenhum atributo escrito.
 */
export const DEFAULT_THEME_MODE: ThemeMode = 'light';

/**
 * Onde a escolha fica.
 *
 * `localStorage` e não cookie: nada aqui interessa ao servidor, e a loja é um
 * site estático — não há renderização no servidor para a qual mandar a
 * preferência. O prefixo evita colisão com o que mais estiver na origem.
 */
export const THEME_STORAGE_KEY = 'maison.theme';

/** A consulta de mídia que decide com que tema a loja abre. */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * A cor da barra do navegador, por tema.
 *
 * É o `--slab` de cada um: no topo da loja fica a barra de avisos, que é a
 * laje. Com a cor do fundo da página, a emenda entre a barra do navegador e
 * a barra de avisos apareceria como um degrau.
 */
export const THEME_COLORS: Record<ThemeMode, string> = {
  light: '#0e0e0e',
  dark: '#16130e',
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

/**
 * A escolha guardada, ou `undefined` quando ainda não houve nenhuma.
 *
 * `undefined` e não um padrão: quem chama precisa distinguir "escolheu claro"
 * de "nunca escolheu", porque só no segundo caso o aparelho tem voz.
 *
 * Tudo dentro de `try`: `localStorage` **lança**, e não devolve `null`, numa
 * aba anônima com cookies bloqueados ou num navegador com dados de site
 * desligados. Sem a guarda, a loja inteira deixaria de montar por causa da
 * preferência de tema.
 */
export function readStoredMode(storage: Pick<Storage, 'getItem'> | undefined): ThemeMode | undefined {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);

    return isThemeMode(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Com que tema a página abre.
 *
 * A escolha guardada manda. Sem ela, o aparelho decide — é a única vez em que
 * ele decide, e é o que torna o primeiro encontro com a loja parecido com o
 * resto do celular de quem chega no escuro.
 */
export function initialMode(
  storage: Pick<Storage, 'getItem'> | undefined,
  systemPrefersDark: boolean,
): ThemeMode {
  return readStoredMode(storage) ?? (systemPrefersDark ? 'dark' : 'light');
}

/**
 * Guarda a escolha, sempre.
 *
 * Com `system` na roda, escolher o padrão apagava a chave — "sem preferência"
 * era a ausência de registro. Agora as duas opções são escolhas de verdade, e
 * apagar a de alguém que escolheu claro num aparelho escuro devolveria a loja
 * ao escuro no próximo carregamento.
 */
export function writeStoredMode(
  storage: Pick<Storage, 'setItem'> | undefined,
  mode: ThemeMode,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Armazenamento indisponível. A escolha vale para esta sessão e não
    // sobrevive ao recarregamento — que é melhor que derrubar a página.
  }
}

/**
 * Leva a escolha ao documento.
 *
 * Duas coisas, e as duas importam:
 *
 * 1. **O atributo `data-theme`.** Sempre escrito, nas duas palavras. O bloco
 *    `@media (prefers-color-scheme: dark)` de `tokens.css` continua lá, mas
 *    só alcança o instante antes do script do `index.html` rodar e o caso em
 *    que ele falha — com o atributo posto, quem manda é ele.
 * 2. **A `<meta name="theme-color">`.** É a faixa que o Android pinta em
 *    volta da página e o que o Safari usa na barra de endereço. Sem
 *    atualizar, o tema escuro sai com uma tarja preta do tema claro em cima.
 */
export function applyTheme(documentElement: HTMLElement, mode: ThemeMode): void {
  documentElement.setAttribute('data-theme', mode);

  const meta = documentElement.ownerDocument.querySelector('meta[name="theme-color"]');

  meta?.setAttribute('content', THEME_COLORS[mode]);
}

/** O rótulo de cada modo, na voz da loja. */
export const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Claro',
  dark: 'Escuro',
};

/** O que o leitor de tela ouve em cada opção. */
export const THEME_DESCRIPTIONS: Record<ThemeMode, string> = {
  light: 'Tema claro',
  dark: 'Tema escuro',
};
