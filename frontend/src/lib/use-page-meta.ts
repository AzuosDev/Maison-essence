import { useEffect } from 'react';

/**
 * O cabecalho do documento, escrito pela pagina que esta em tela.
 *
 * Titulo, descricao, Open Graph e JSON-LD saem todos daqui, e as tags que
 * este hook cria levam `data-page-meta` para que ele saiba quais sao suas:
 * ao sair da pagina, elas somem e o `<title>` volta ao que estava no
 * `index.html`. Sem isso, navegar de um produto para outro deixaria a foto
 * do primeiro no `og:image` do segundo.
 *
 * ## O que este hook nao resolve
 *
 * A loja e uma SPA: o HTML servido e o mesmo `index.html` vazio para todo
 * endereco, e estas tags so existem depois que o JavaScript roda. O
 * rastreador do WhatsApp — e o do Facebook, e o do Twitter — le o HTML como
 * ele chega e **nao executa JavaScript**. Entao a previa com foto e preco,
 * que e o principal canal de divulgacao desta loja, depende de o HTML ja
 * nascer com as tags: prerender no build ou renderizacao no servidor, que e
 * o assunto do prompt de SEO e performance.
 *
 * O que fica pronto aqui e a metade que nao muda com essa escolha: as tags
 * sao montadas por funcoes puras (`productMeta`, em `features/catalog`), e
 * quem prerenderizar vai chamar as mesmas funcoes para escrever o mesmo
 * conteudo no HTML. O Google, que executa JavaScript, ja le o que este hook
 * escreve hoje.
 */

export interface PageMeta {
  /** O `<title>` inteiro, como aparece na aba e no resultado da busca. */
  title: string;
  description: string;
  /** O endereco canonico, absoluto. Sem os parametros de estado da tela. */
  canonical?: string;
  /** URL absoluta da imagem da previa. */
  image?: string;
  /** `product` na pagina do produto, `website` no resto. */
  type?: 'website' | 'product';
  /**
   * O que o rastreador pode fazer com esta pagina.
   *
   * Ausente na loja inteira, que existe para ser encontrada. `noindex` vale
   * para as telas que sao de uma pessoa so e nao dizem nada a quem chega de
   * fora — a sacola, o checkout, a conta. Sem ele, o endereco da sacola
   * entra no indice e aparece na busca como uma pagina vazia da loja.
   */
  robots?: string;
  /** O objeto de dados estruturados, ja pronto. */
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
  // O JSON-LD entra como texto na lista de dependencias de proposito: o
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

    // `summary_large_image` e o que faz a foto ocupar a largura do cartao.
    // Sem a imagem, o cartao pequeno e o formato honesto.
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
 * Conteudo vazio remove a tag em vez de escrever `content=""`: uma pagina
 * sem foto nao deve anunciar uma imagem vazia ao rastreador, que e coisa que
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
 * O conteudo entra por `textContent`, e nunca por `innerHTML`: o nome do
 * produto vem do painel, e um `</script>` digitado la dentro nao pode
 * fechar a tag e virar markup. `JSON.stringify` ja escapa o resto.
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
