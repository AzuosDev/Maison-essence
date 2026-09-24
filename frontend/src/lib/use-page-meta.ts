import { useEffect } from 'react';

/**
 * O cabeçalho do documento, escrito pela página que esta em tela.
 *
 * Título, descrição, Open Graph e JSON-LD saem todos daqui, e as tags que
 * este hook cria levam `data-page-meta` para que ele saiba quais são suas:
 * ao sair da página, elas somem e o `<title>` volta ao que estava no
 * `index.html`. Sem isso, navegar de um produto para outro deixaria a foto
 * do primeiro no `og:image` do segundo.
 *
 * ## O que este hook não resolve
 *
 * A loja e uma SPA: o HTML servido e o mesmo `index.html` vazio para todo
 * endereço, e estas tags só existem depois que o JavaScript roda. O
 * rastreador do WhatsApp — e o do Facebook, e o do Twitter — lê o HTML como
 * ele chega e **não executa JavaScript**. Então a prévia com foto e preço,
 * que e o principal canal de divulgação desta loja, depende de o HTML já
 * nascer com as tags: prerender no build ou renderização no servidor, que e
 * o assunto do prompt de SEO e performance.
 *
 * O que fica pronto aqui e a metade que não muda com essa escolha: as tags
 * são montadas por funções puras (`productMeta`, em `features/catalog`), e
 * quem prerenderizar vai chamar as mesmas funções para escrever o mesmo
 * conteúdo no HTML. O Google, que executa JavaScript, já lê o que este hook
 * escreve hoje.
 */

export interface PageMeta {
  /** O `<title>` inteiro, como aparece na aba e no resultado da busca. */
  title: string;
  description: string;
  /** O endereço canônico, absoluto. Sem os parâmetros de estado da tela. */
  canonical?: string;
  /** URL absoluta da imagem da prévia. */
  image?: string;
  /** `product` na página do produto, `website` no resto. */
  type?: 'website' | 'product';
  /**
   * O que o rastreador pode fazer com esta página.
   *
   * Ausente na loja inteira, que existe para ser encontrada. `noindex` vale
   * para as telas que são de uma pessoa só e não dizem nada a quem chega de
   * fora — a sacola, o checkout, a conta. Sem ele, o endereço da sacola
   * entra no índice e aparece na busca como uma página vazia da loja.
   */
  robots?: string;
  /** O objeto de dados estruturados, já pronto. */
  jsonLd?: unknown;
}

/** A marca das tags que este hook governa. */
const OWNED = 'data-page-meta';

export function usePageMeta({
  title,
  description,
  canonical,
  image,
  type = 'website',
  robots,
  jsonLd,
}: PageMeta): void {
  // O JSON-LD entra como texto na lista de dependências de propósito: o
  // objeto e remontado a cada render, e comparar por identidade reescreveria
  // a tag em todo quadro.
  const structured = jsonLd === undefined ? '' : JSON.stringify(jsonLd);

  useEffect(() => {
    const previousTitle = document.title;

    document.title = title;

    setMeta('name', 'description', description);
    setMeta('name', 'robots', robots ?? '');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', 'Maison Essence');
    setMeta('property', 'og:locale', 'pt_BR');
    setMeta('property', 'og:url', canonical ?? '');
    setMeta('property', 'og:image', image ?? '');

    // `summary_large_image` e o que faz a foto ocupar a largura do cartão.
    // Sem a imagem, o cartão pequeno e o formato honesto.
    setMeta('name', 'twitter:card', image === undefined ? 'summary' : 'summary_large_image');

    setCanonical(canonical);
    setJsonLd(structured);

    return () => {
      document.title = previousTitle;

      for (const node of document.head.querySelectorAll(`[${OWNED}]`)) {
        node.remove();
      }
    };
  }, [title, description, canonical, image, type, robots, structured]);
}

/**
 * Uma tag `<meta>`, criada ou atualizada.
 *
 * Conteúdo vazio remove a tag em vez de escrever `content=""`: uma página
 * sem foto não deve anunciar uma imagem vazia ao rastreador, que e coisa que
 * alguns leem como imagem quebrada.
 */
function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector(selector);

  if (content === '') {
    if (existing?.hasAttribute(OWNED)) {
      existing.remove();
    }

    return;
  }

  const tag = existing ?? createOwned('meta');

  tag.setAttribute(attribute, key);
  tag.setAttribute('content', content);
}

function setCanonical(href: string | undefined): void {
  const existing = document.head.querySelector('link[rel="canonical"]');

  if (href === undefined) {
    existing?.remove();

    return;
  }

  const tag = existing ?? createOwned('link');

  tag.setAttribute('rel', 'canonical');
  tag.setAttribute('href', href);
}

/**
 * Os dados estruturados, como `<script type="application/ld+json">`.
 *
 * O conteúdo entra por `textContent`, e nunca por `innerHTML`: o nome do
 * produto vem do painel, e um `</script>` digitado lá dentro não pode
 * fechar a tag e virar markup. `JSON.stringify` já escapa o resto.
 */
function setJsonLd(json: string): void {
  const selector = `script[type="application/ld+json"][${OWNED}]`;
  const existing = document.head.querySelector(selector);

  if (json === '') {
    existing?.remove();

    return;
  }

  const tag = existing ?? createOwned('script');

  tag.setAttribute('type', 'application/ld+json');
  tag.textContent = json;
}

function createOwned(tagName: 'meta' | 'link' | 'script'): HTMLElement {
  const node = document.createElement(tagName);

  node.setAttribute(OWNED, '');
  document.head.append(node);

  return node;
}
