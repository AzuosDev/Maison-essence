import { useCallback, useState } from 'react';

/**
 * As buscas recentes de quem esta neste navegador.
 *
 * Ficam só aqui, no `localStorage`: não vão para a API, não ficam ligadas a
 * conta nenhuma e não saem deste aparelho. Uma lista do que alguém procurou
 * numa perfumaria e um dado mais pessoal do que parece, e ela não precisa
 * existir em lugar nenhum além da máquina de quem digitou.
 *
 * Toda leitura e escrita esta dentro de `try`: em aba anonima, com dados de
 * site bloqueados ou com a cota estourada, `localStorage` lança em vez de
 * devolver vazio. Perder o histórico e aceitável; derrubar a busca por causa
 * dele não e.
 */

const STORAGE_KEY = 'maison-essence.recent-searches';

/** Cinco. A lista e um atalho, não um arquivo. */
const MAX_ITEMS = 5;

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function write(items: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sem histórico nesta sessão. A busca continua funcionando.
  }
}

interface RecentSearches {
  recent: string[];
  remember: (term: string) => void;
  forget: (term: string) => void;
  clear: () => void;
}

export function useRecentSearches(): RecentSearches {
  // A leitura inicial e preguicosa: roda uma vez, na montagem, e não a cada
  // render da caixa de busca.
  const [recent, setRecent] = useState<string[]>(read);

  const remember = useCallback((term: string) => {
    const trimmed = term.trim();

    if (trimmed === '') {
      return;
    }

    setRecent((current) => {
      // O termo repetido sobe para o topo em vez de duplicar — e o mesmo
      // comportamento do histórico do navegador.
      const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, MAX_ITEMS);

      write(next);

      return next;
    });
  }, []);

  const forget = useCallback((term: string) => {
    setRecent((current) => {
      const next = current.filter((item) => item !== term);

      write(next);

      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecent([]);
    write([]);
  }, []);

  return { recent, remember, forget, clear };
}
