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
 * Configurações da loja e páginas institucionais: trinta segundos.
 *
 * Eram cinco minutos de `s-maxage` com dez de `stale-while-revalidate`, com a
 * justificativa de que o ETag encurtaria a janela depois de uma alteração.
 * **Ele não encurta.** ETag economiza corpo na revalidação; ele não faz a
 * borda revalidar antes da hora. Enquanto a entrada estava fresca a CDN
 * respondia a resposta velha — ou um 304 que mandava o navegador servir a
 * cópia velha dele — sem nunca perguntar nada a esta função. Trocar um banner
 * de vaga e recarregar a loja mostrava a home de antes por cinco minutos
 * certos, e por até quinze no total com a janela de `stale-while-revalidate`.
 * Quem mexe no painel conclui, com razão, que o painel não gravou.
 *
 * São lidas em *toda* página — cabeçalho, rodapé, barra de avisos, banners da
 * home e o botão do WhatsApp saem daqui —, então a borda continua existindo:
 * trinta segundos ainda absorvem a rajada de quem chega por um link
 * compartilhado, que e o tráfego que esta janela foi criada para segurar. O
 * que sai e a promessa de que a dona pode esperar sentada.
 *
 * O `stale-while-revalidate` ficou curto, e não zerado: ele e o que evita que
 * a primeira visitante depois de cada janela pague o tempo de a função
 * acordar. Entre ver a moldura da loja meio minuto atrasada e ver a página
 * parada esperando um cold start, o atraso e o mal menor — e o prejuízo dele
 * agora e de um minuto e meio no pior caso, não de quinze.
 */
export const SETTINGS_CACHE: CdnCacheOptions = { sMaxAge: 30, staleWhileRevalidate: 60 };

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
