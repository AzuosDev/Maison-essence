import { HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * ETag das rotas publicas que a CDN guarda.
 *
 * A validacao existe porque cache compartilhado sozinho nao resolve o caso
 * das configuracoes: a dona troca o numero do WhatsApp e quer ver a mudanca,
 * nao esperar o `s-maxage` vencer com a certeza de que a resposta velha ainda
 * esta correta. Com ETag, a borda pergunta "mudou?" e a funcao responde 304
 * sem serializar nada quando nada mudou — e responde 200 com o corpo novo no
 * instante seguinte ao PATCH.
 *
 * O ETag e fraco (`W/`) de proposito: ele identifica o *conteudo semantico*
 * da resposta, nao os bytes. Duas respostas com os mesmos campos em ordem
 * diferente sao equivalentes para o cliente, e `W/` e o que autoriza a CDN a
 * trata-las assim.
 */

/** Marca a versao como ETag fraco. */
export function weakEtag(version: string): string {
  return `W/"${version}"`;
}

/**
 * FNV-1a de 32 bits, em hexadecimal.
 *
 * Nao e hash criptografico e nao precisa ser: o que se espera dele e que
 * mudar um campo mude a saida. Escolhido por ser curto e nao custar nada —
 * este calculo roda em toda leitura da vitrine.
 */
export function hashOf(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    // O deslocamento e a multiplicacao por 16777619 do algoritmo, escrita em
    // somas para nao estourar a precisao do numero.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

/**
 * ETag de uma resposta que tem data de alteracao.
 *
 * Junta as duas coisas que fazem o valor mudar: o `updatedAt` do documento,
 * que salta a cada PATCH do painel, e o conteudo efetivamente entregue, que
 * pode mudar sozinho — um banner agendado entra ou sai do ar sem ninguem
 * tocar nas configuracoes, e so o `updatedAt` deixaria a borda servir a home
 * de ontem.
 */
export function versionedEtag(updatedAt: Date, payload: unknown): string {
  return weakEtag(`${updatedAt.getTime()}-${hashOf(JSON.stringify(payload))}`);
}

/**
 * Diz se o cliente ja tem esta versao.
 *
 * Comparacao fraca, como manda a RFC 9110 para GET: o prefixo `W/` e
 * ignorado dos dois lados. O `If-None-Match` pode trazer varias etiquetas
 * separadas por virgula, e `*` significa "qualquer versao que exista".
 */
export function isNotModified(request: Request, etag: string): boolean {
  const header = request.headers['if-none-match'];

  if (!header) {
    return false;
  }

  const wanted = withoutWeakPrefix(etag);

  return (Array.isArray(header) ? header : [header])
    .flatMap((value) => value.split(','))
    .map((value) => withoutWeakPrefix(value.trim()))
    .some((candidate) => candidate === '*' || candidate === wanted);
}

function withoutWeakPrefix(etag: string): string {
  return etag.startsWith('W/') ? etag.slice(2) : etag;
}

/**
 * Responde com validacao de cache: escreve o `ETag` e devolve 304 sem corpo
 * quando o cliente ja tem esta versao.
 *
 * Quem chama devolve o resultado direto do handler — `undefined` no 304, que
 * o Express entrega como resposta vazia, do jeito que a RFC pede. O
 * `Cache-Control` continua sendo escrito pelo interceptor do `@CdnCache()`,
 * inclusive no 304: sem ele a borda esqueceria a janela de cache justamente
 * na revalidacao.
 */
export function serveWithEtag<T>(
  request: Request,
  response: Response,
  updatedAt: Date,
  payload: T,
): T | undefined {
  const etag = versionedEtag(updatedAt, payload);

  response.setHeader('ETag', etag);

  if (isNotModified(request, etag)) {
    response.status(HttpStatus.NOT_MODIFIED);

    return undefined;
  }

  return payload;
}
