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
 * Configuracoes da loja e paginas institucionais: cinco minutos.
 *
 * Aguentam mais cache que o catalogo porque mudam menos — o nome da loja, o
 * endereco de retirada e o texto de "Quem somos" ficam meses parados — e
 * porque sao lidos em *toda* pagina: o cabecalho, o rodape e o botao do
 * WhatsApp saem daqui. Quem encurta a janela real depois de uma alteracao e
 * o ETag, que muda junto com o `updatedAt` do documento.
 */
export const SETTINGS_CACHE: CdnCacheOptions = { sMaxAge: 300, staleWhileRevalidate: 600 };

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
