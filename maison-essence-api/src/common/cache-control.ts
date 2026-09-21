import { SetMetadata } from '@nestjs/common';

export const CDN_CACHE_KEY = 'cdnCache';

export interface CdnCacheOptions {
  /** Segundos que a CDN serve a resposta sem perguntar de novo. */
  sMaxAge: number;
  /** Janela em que a CDN serve o conteudo vencido enquanto revalida atras. */
  staleWhileRevalidate: number;
}

/** Catalogo publico: muda quando a dona mexe no painel, nao a cada minuto. */
export const CATALOG_CACHE: CdnCacheOptions = { sMaxAge: 60, staleWhileRevalidate: 300 };

/**
 * Monta o `Cache-Control` das rotas publicas.
 *
 * `max-age=0` junto do `s-maxage` de proposito: quem absorve o trafego e a
 * CDN, e o navegador do cliente revalida sempre. Sem ele, o navegador aplica
 * heuristica propria e pode guardar um preco antigo por horas — e preco
 * errado na tela de quem ja esta comprando custa mais caro que a requisicao
 * economizada.
 *
 * `stale-while-revalidate` e o que faz a troca de preco nao derrubar ninguem
 * em fila: passado o s-maxage, a CDN entrega o conteudo vencido na hora e
 * busca o novo por tras.
 */
export function cacheControlOf({ sMaxAge, staleWhileRevalidate }: CdnCacheOptions): string {
  return `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
}

/**
 * Marca a rota como cacheavel pela CDN. Sem o decorator, nenhum cabecalho e
 * escrito — rota autenticada nunca deve encostar em cache compartilhado.
 */
export const CdnCache = (options: CdnCacheOptions = CATALOG_CACHE) =>
  SetMetadata(CDN_CACHE_KEY, options);
