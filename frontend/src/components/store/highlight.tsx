import { Fragment, type ReactElement } from 'react';
import { foldAccents } from '@/lib/text';

/**
 * O termo buscado, realcado dentro de um texto.
 *
 * So a busca usa isto. Serve para o cliente entender **por que** aquele
 * produto apareceu: quem procurou "amadeirado" e recebeu "Oud Wood" precisa
 * ver que o casamento foi na marca, e nao no nome.
 *
 * A comparacao ignora caixa e acento. O catalogo e escrito por uma pessoa,
 * no painel, e ninguem digita "Agua" com trema na busca so porque o cadastro
 * tem: quem procura "acqua" tem que achar "Acqua" e "Àcqua". A normalizacao
 * e feita sobre uma copia do texto, e o que vai para a tela continua sendo o
 * original, com os acentos que a dona cadastrou.
 *
 * O elemento e `<mark>`, e nao um `<span>` pintado: leitor de tela anuncia
 * trecho marcado, e o realce deixa de ser informacao exclusiva de quem
 * enxerga.
 */

export interface HighlightProps {
  text: string;
  /** O termo. Vazio — fora da busca — devolve o texto intocado. */
  term: string;
}

export function Highlight({ text, term }: HighlightProps): ReactElement {
  const ranges = matchRanges(text, term);

  if (ranges.length === 0) {
    return <>{text}</>;
  }

  const parts: ReactElement[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    parts.push(
      <Fragment key={start}>
        {text.slice(cursor, start)}
        <mark>{text.slice(start, end)}</mark>
      </Fragment>,
    );

    cursor = end;
  }

  return (
    <>
      {parts}
      {text.slice(cursor)}
    </>
  );
}

/**
 * Onde cada palavra do termo aparece no texto, sem sobrepor.
 *
 * O termo e quebrado em palavras porque a busca do backend tambem quebra:
 * "perfume amadeirado" casa com um produto que tem as duas palavras em
 * lugares diferentes do nome, e realcar so a frase inteira nao marcaria
 * nada. As faixas saem em ordem e sem encavalar — duas palavras do termo
 * podem cair no mesmo pedaco do texto.
 */
function matchRanges(text: string, term: string): [number, number][] {
  const words = foldAccents(term)
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return [];
  }

  // A busca acontece na copia sem acento, que tem o mesmo comprimento do
  // original — e por isso os indices encontrados valem nos dois.
  const haystack = foldAccents(text);
  const found: [number, number][] = [];

  for (const word of words) {
    let from = 0;

    for (;;) {
      const at = haystack.indexOf(word, from);

      if (at === -1) {
        break;
      }

      found.push([at, at + word.length]);
      from = at + word.length;
    }
  }

  return merge(found);
}

function merge(ranges: [number, number][]): [number, number][] {
  const sorted = ranges.toSorted((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];

  for (const range of sorted) {
    const last = merged.at(-1);

    if (last !== undefined && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);

      continue;
    }

    merged.push([...range]);
  }

  return merged;
}
