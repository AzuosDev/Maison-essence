import { SetMetadata } from '@nestjs/common';

export const CDN_CACHE_KEY = 'cdnCache';

export interface CdnCacheOptions {
  /** Segundos que a CDN serve a resposta sem perguntar de novo. */
  sMaxAge: number;
  /** Janela em que a CDN serve o conteúdo vencido enquanto revalida atrás. */
  staleWhileRevalidate: number;
}

/** Catálogo público: muda quando a dona mexe no painel, não a cada minuto. */
export const CATALOG_CACHE: CdnCacheOptions = { sMaxAge: 60, staleWhileRevalidate: 300 };

/**
 * Configurações da loja e páginas institucionais: cinco minutos.
 *
 * Aguentam mais cache que o catálogo porque mudam menos — o nome da loja, o
 * endereço de retirada e o texto de "Quem somos" ficam meses parados — e
 * porque são lidos em *toda* página: o cabeçalho, o rodapé e o botão do
 * WhatsApp saem daqui. Quem encurta a janela real depois de uma alteração e
 * o ETag, que muda junto com o `updatedAt` do documento.
 */
export const SETTINGS_CACHE: CdnCacheOptions = { sMaxAge: 300, staleWhileRevalidate: 600 };

/**
 * Monta o `Cache-Control` das rotas públicas.
 *
 * `max-age=0` junto do `s-maxage` de propósito: quem absorve o tráfego e a
 * CDN, e o navegador do cliente revalida sempre. Sem ele, o navegador aplica
 * heurística própria e pode guardar um preço antigo por horas — e preço
 * errado na tela de quem já esta comprando custa mais caro que a requisição
 * economizada.
 *
 * `stale-while-revalidate` e o que faz a troca de preço não derrubar ninguém
 * em fila: passado o s-maxage, a CDN entrega o conteúdo vencido na hora e
 * busca o novo por trás.
 */
export function cacheControlOf({ sMaxAge, staleWhileRevalidate }: CdnCacheOptions): string {
  return `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
}

/**
 * Marca a rota como cacheável pela CDN. Sem o decorator, nenhum cabeçalho e
 * escrito — rota autenticada nunca deve encostar em cache compartilhado.
 */
export const CdnCache = (options: CdnCacheOptions = CATALOG_CACHE) =>
  SetMetadata(CDN_CACHE_KEY, options);
