import { createElement, Fragment, type ReactNode } from 'react';

/**
 * O Markdown que a dona escreve no painel, desenhado como React.
 *
 * As paginas institucionais — trocas e devolucoes, como comprar — sao
 * guardadas como Markdown e aparecem nas abas da pagina do produto. Alguem
 * precisa transformar `**aviso**` em negrito, e ha duas maneiras de fazer
 * isso.
 *
 * A comum e converter para HTML e injetar com `dangerouslySetInnerHTML`.
 * Nao e o que este arquivo faz, e a razao e direta: o texto vem de um
 * formulario. Um `<script>` colado ali por acidente — ou por alguem que
 * entrou no painel — viraria script de verdade na loja de todo cliente.
 * Aqui o Markdown vira **elementos React**, e texto e sempre texto: o pior
 * que um `<script>` digitado pode fazer e aparecer escrito na tela.
 *
 * ## O subconjunto
 *
 * Titulo, paragrafo, lista, negrito, italico e link. E o que cabe numa
 * politica de trocas, e cada coisa a mais seria uma regra nova para manter
 * por um uso que ninguem pediu. O que nao e reconhecido aparece como foi
 * escrito, em vez de sumir — esta e a diferenca entre um texto com um
 * asterisco sobrando e um paragrafo que o cliente nunca le.
 *
 * Quebra de linha simples vira `<br>`, e nao espaco como manda o Markdown
 * canonico: quem escreve um endereco ou um horario de atendimento no painel
 * aperta Enter esperando ver a linha quebrada.
 */

export interface MarkdownProps {
  /** O texto como foi escrito. Vazio nao desenha nada. */
  text: string;
  /**
   * O nivel do primeiro titulo (`#`).
   *
   * Tres por padrao, que e onde as abas da pagina do produto estao: o `h1` e
   * o nome do produto e o `h2` e o titulo do bloco. Um `#` virando `<h1>`
   * dentro de uma aba daria dois primeiros titulos a mesma pagina.
   */
  headingLevel?: 2 | 3 | 4;
  className?: string | undefined;
}

export function Markdown({ text, headingLevel = 3, className }: MarkdownProps) {
  const blocks = blocksOf(text);

  if (blocks.length === 0) {
    return null;
  }

  return <div className={className}>{blocks.map((block, index) => renderBlock(block, index, headingLevel))}</div>;
}

/* ---- Os blocos ---------------------------------------------------------- */

interface Block {
  kind: 'heading' | 'paragraph' | 'bullets' | 'numbers';
  /** O nivel do titulo, contado a partir do `headingLevel`. */
  depth: number;
  lines: string[];
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

/**
 * O texto dividido em blocos.
 *
 * Linha em branco separa blocos, como no Markdown. Dentro de um bloco, o
 * tipo e decidido pela primeira linha: se ela e um item de lista, o bloco e
 * uma lista, e as linhas que nao sao itens entram como continuacao do item
 * anterior — que e o que acontece quando alguem quebra uma frase longa no
 * meio.
 */
function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];

  for (const chunk of text.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');

    if (lines.length === 0) {
      continue;
    }

    const [first = ''] = lines;
    const heading = HEADING.exec(first);

    if (heading) {
      blocks.push({ kind: 'heading', depth: (heading[1] ?? '#').length, lines: [heading[2] ?? ''] });

      // O resto do bloco, se houver, e paragrafo: um titulo nao continua na
      // linha de baixo.
      if (lines.length > 1) {
        blocks.push({ kind: 'paragraph', depth: 0, lines: lines.slice(1) });
      }

      continue;
    }

    if (BULLET.test(first)) {
      blocks.push({ kind: 'bullets', depth: 0, lines: itemsOf(lines, BULLET) });
      continue;
    }

    if (NUMBER.test(first)) {
      blocks.push({ kind: 'numbers', depth: 0, lines: itemsOf(lines, NUMBER) });
      continue;
    }

    blocks.push({ kind: 'paragraph', depth: 0, lines });
  }

  return blocks;
}

/** Os itens de uma lista, com as linhas soltas grudadas no item anterior. */
function itemsOf(lines: readonly string[], marker: RegExp): string[] {
  const items: string[] = [];

  for (const line of lines) {
    const match = marker.exec(line);

    if (match) {
      items.push(match[1] ?? '');
      continue;
    }

    const last = items.length - 1;

    if (last >= 0) {
      items[last] = `${items[last] ?? ''} ${line.trim()}`;
    }
  }

  return items;
}

function renderBlock(block: Block, index: number, headingLevel: number): ReactNode {
  const key = `block-${String(index)}`;

  if (block.kind === 'heading') {
    // O `#` mais fundo que o documento comporta vira o menor titulo, e nao
    // um `<h7>` que nao existe.
    const level = Math.min(headingLevel + block.depth - 1, 6);

    return createElement(`h${String(level)}`, { key }, inline(block.lines[0] ?? ''));
  }

  if (block.kind === 'bullets' || block.kind === 'numbers') {
    const Tag = block.kind === 'bullets' ? 'ul' : 'ol';

    return (
      <Tag key={key}>
        {block.lines.map((item, position) => (
          <li key={`${key}-${String(position)}`}>{inline(item)}</li>
        ))}
      </Tag>
    );
  }

  return (
    <p key={key}>
      {block.lines.map((line, position) => (
        <Fragment key={`${key}-${String(position)}`}>
          {position === 0 ? null : <br />}
          {inline(line)}
        </Fragment>
      ))}
    </p>
  );
}

/* ---- O que vai dentro da linha ------------------------------------------ */

/**
 * Negrito, italico e link.
 *
 * Uma passada so, com uma expressao que reconhece as quatro formas de uma
 * vez: percorrer o texto quatro vezes faria `**[texto](url)**` perder o
 * link. O que nao casa com nenhuma delas e copiado como esta.
 */
const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  // `matchAll` cria um iterador proprio e nao depende do `lastIndex` da
  // expressao, que e global e seria compartilhado entre chamadas.
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;

    if (at > cursor) {
      nodes.push(text.slice(cursor, at));
    }

    nodes.push(inlineNode(match, nodes.length));
    cursor = at + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function inlineNode(match: RegExpMatchArray, key: number): ReactNode {
  const [, bold, star, underscore, label, href] = match;

  if (bold !== undefined) {
    return <strong key={key}>{bold}</strong>;
  }

  if (star !== undefined || underscore !== undefined) {
    return <em key={key}>{star ?? underscore}</em>;
  }

  if (label !== undefined && href !== undefined) {
    return (
      <a
        key={key}
        href={safeHref(href)}
        // Link escrito no painel pode apontar para fora — o Instagram da
        // loja, um formulario. `noreferrer` junto de `_blank` e o que impede
        // a pagina aberta de mexer nesta pela `window.opener`.
        {...(href.startsWith('/') ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
      >
        {label}
      </a>
    );
  }

  return match[0];
}

/**
 * O endereco do link, quando ele e um endereco.
 *
 * `javascript:` num `href` executa ao clique, e o texto vem de um
 * formulario. So `http`, `https`, `mailto`, `tel` e caminho interno passam;
 * o resto vira `#`, um link que nao leva a lugar nenhum e nao faz nada.
 */
const SAFE_PROTOCOL = /^(?:https?:|mailto:|tel:|\/)/i;

function safeHref(href: string): string {
  return SAFE_PROTOCOL.test(href.trim()) ? href.trim() : '#';
}
