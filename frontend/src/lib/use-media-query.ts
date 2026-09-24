import { useEffect, useState } from 'react';

/**
 * Um `@media` respondido em JavaScript.
 *
 * Existe para o punhado de casos em que o CSS não basta porque a diferença
 * não e de aparência, e sim de comportamento: a vitrine página com "carregar
 * mais" no celular e com números no desktop, e isso muda quantas páginas o
 * componente busca — não só como as desenha.
 *
 * Quando a resposta e puramente visual, o CSS continua sendo o lugar certo.
 * Um `@media` não remonta componente, não dispara render e não pode divergir
 * do que esta na folha de estilo.
 *
 * A consulta e lida já no inicializador do estado, e não num efeito. Ler
 * depois significaria desenhar um quadro com a resposta errada — o celular
 * veria a paginação numerada aparecer e sumir. O efeito só assina as
 * mudancas seguintes; a primeira resposta já veio no render.
 *
 * O `matchMedia` pode não existir: em teste sob jsdom, por exemplo. Nesse
 * caso a resposta e `false`, que e o estilo base do projeto — o celular.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => currentlyMatches(query));

  useEffect(() => {
    const list = mediaList(query);

    if (list === null) {
      return;
    }

    const onChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    list.addEventListener('change', onChange);

    return () => {
      list.removeEventListener('change', onChange);
    };
  }, [query]);

  return matches;
}

function currentlyMatches(query: string): boolean {
  return mediaList(query)?.matches ?? false;
}

function mediaList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia(query);
}
