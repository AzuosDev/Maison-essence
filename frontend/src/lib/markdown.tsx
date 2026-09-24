import { createElement, Fragment, type ReactNode } from 'react';

/**
 * O Markdown que a dona escreve no painel, desenhado como React.
 *
 * As páginas institucionais — trocas e devoluções, como comprar — são
 * guardadas como Markdown e aparecem nas abas da página do produto. Alguém
 * precisa transformar `**aviso**` em negrito, e há duas maneiras de fazer
 * isso.
 *
 * A comum e converter para HTML e injetar com `dangerouslySetInnerHTML`.
 * Não e o que este arquivo faz, e a razão e direta: o texto vem de um
 * formulário. Um `<script>` colado ali por acidente — ou por alguém que
 * entrou no painel — viraria script de verdade na loja de todo cliente.
 * Aqui o Markdown vira **elementos React**, e texto e sempre texto: o pior
 * que um `<script>` digitado pode fazer e aparecer escrito na tela.
 *
 * ## O subconjunto
 *
 * Título, parágrafo, lista, negrito, itálico e link. E o que cabe numa
 * política de trocas, e cada coisa a mais seria uma regra nova para manter
 * por um uso que ninguém pediu. O que não e reconhecido aparece como foi
 * escrito, em vez de sumir — esta e a diferença entre um texto com um
 * asterisco sobrando e um parágrafo que o cliente nunca lê.
 *
 * Quebra de linha simples vira `<br>`, e não espaço como manda o Markdown
 * canônico: quem escreve um endereço ou um horário de atendimento no painel
 * aperta Enter esperando ver a linha quebrada.
 */

export interface MarkdownProps {
  /** O texto como foi escrito. Vazio não desenha nada. */
  text: string;
  /**
   * O nível do primeiro título (`#`).
   *
   * Três por padrão, que e onde as abas da página do produto estão: o `h1` e
   * o nome do produto e o `h2` e o título do bloco. Um `#` virando `<h1>`
   * dentro de uma aba daria dois primeiros títulos a mesma página.
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
  /** O nível do título, contado a partir do `headingLevel`. */
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
 * uma lista, e as linhas que não são itens entram como continuação do item
 * anterior — que e o que acontece quando alguém quebra uma frase longa no
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

      // O resto do bloco, se houver, e parágrafo: um título não continua na
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
    // O `#` mais fundo que o documento comporta vira o menor título, e não
    // um `<h7>` que não existe.
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
 * Negrito, itálico e link.
 *
 * Uma passada só, com uma expressão que reconhece as quatro formas de uma
 * vez: percorrer o texto quatro vezes faria `**[texto](url)**` perder o
 * link. O que não casa com nenhuma delas e copiado como esta.
 */
const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  // `matchAll` cria um iterador próprio e não depende do `lastIndex` da
  // expressão, que e global e seria compartilhado entre chamadas.
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
        // loja, um formulário. `noreferrer` junto de `_blank` e o que impede
        // a página aberta de mexer nesta pela `window.opener`.
        {...(href.startsWith('/') ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
      >
        {label}
      </a>
    );
  }

  return match[0];
}

/**
 * O endereço do link, quando ele e um endereço.
 *
 * `javascript:` num `href` executa ao clique, e o texto vem de um
 * formulário. Só `http`, `https`, `mailto`, `tel` e caminho interno passam;
 * o resto vira `#`, um link que não leva a lugar nenhum e não faz nada.
 */
const SAFE_PROTOCOL = /^(?:https?:|mailto:|tel:|\/)/i;

function safeHref(href: string): string {
  return SAFE_PROTOCOL.test(href.trim()) ? href.trim() : '#';
}
