import { api, SESSION_SCOPES } from '@/lib/http';
import type { UploadFolder, UploadSignature, UploadedImage } from './admin.types';

/**
 * O envio de uma foto, em tres tempos.
 *
 * ```
 *   painel  ──1──▶  API      pede a assinatura
 *   painel  ──2──▶  Cloudinary   manda o arquivo, com a assinatura junto
 *   painel  ──3──▶  API      confirma, e a API confere o arquivo na conta
 * ```
 *
 * O arquivo **nao passa pelo backend**, e essa e a razao de existirem tres
 * passos em vez de um `POST` com `multipart`. A API roda como funcao
 * serverless: um JPEG de 4 MB atravessando-a gastaria memoria, tempo de
 * execucao e o limite de corpo da plataforma, para no fim entregar o arquivo
 * ao mesmo Cloudinary que o navegador alcanca sozinho.
 *
 * O preco disso e que o passo 3 nao e formalidade. Entre o 2 e o 3 o arquivo
 * ja existe na conta, e so a confirmacao verifica o que de fato chegou la —
 * formato, tamanho, dimensoes — e devolve os numeros do servidor, e nao os
 * que o navegador afirmou.
 *
 * ## O que este modulo nao faz
 *
 * Nao guarda estado, nao mostra progresso e nao sabe o que e um produto.
 * Quem orquestra os tres passos, conta o progresso e trata a falha do meio e
 * `use-image-upload.ts`.
 */

/** Passo 1: a autorizacao. A pasta e uma chave curta; o caminho e do servidor. */
export function createUploadSignature(
  folder: UploadFolder,
  filename?: string,
  signal?: AbortSignal,
): Promise<UploadSignature> {
  return api.post<UploadSignature>(
    '/admin/uploads/signature',
    { folder, ...(filename === undefined ? {} : { filename }) },
    { scope: SESSION_SCOPES.ADMIN, ...(signal ? { signal } : {}) },
  );
}

/**
 * Passo 2: o arquivo vai para o Cloudinary.
 *
 * `fetch` cru, e nao o cliente da aplicacao: o destino e outro dominio, a
 * autenticacao e a assinatura (nao o nosso token) e mandar o `Authorization`
 * do painel para um terceiro seria vazar a sessao.
 *
 * Os campos de `params` sao copiados **literalmente**, na ordem em que
 * vieram. Acrescentar, remover ou reescrever qualquer um deles invalida a
 * assinatura, e o Cloudinary responde com um erro que nao diz qual foi.
 */
export async function uploadToCloudinary(
  signature: UploadSignature,
  file: File,
  signal?: AbortSignal,
): Promise<{ publicId: string; format: string; bytes: number; width: number; height: number }> {
  const form = new FormData();

  for (const [key, value] of Object.entries(signature.params)) {
    form.append(key, String(value));
  }

  form.append('api_key', signature.apiKey);
  form.append('signature', signature.signature);
  form.append('file', file);

  const response = await fetch(signature.uploadUrl, {
    method: 'POST',
    body: form,
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(await cloudinaryMessage(response));
  }

  const body = (await response.json()) as {
    public_id?: unknown;
    format?: unknown;
    bytes?: unknown;
    width?: unknown;
    height?: unknown;
  };

  return {
    // O `publicId` devolvido pela assinatura e o que vale: ele foi assinado, e
    // o do corpo da resposta e apenas o eco. Usar o eco abriria a porta para
    // um arquivo gravado em outro lugar passar pela confirmacao.
    publicId: signature.publicId,
    format: text(body.format),
    bytes: count(body.bytes),
    width: count(body.width),
    height: count(body.height),
  };
}

/** Passo 3: a API confere o arquivo na conta e devolve os numeros de la. */
export function confirmUpload(
  uploaded: { publicId: string; format?: string; bytes?: number; width?: number; height?: number },
  signal?: AbortSignal,
): Promise<UploadedImage> {
  return api.post<UploadedImage>('/admin/uploads/confirm', uploaded, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * Apaga a imagem da conta do Cloudinary.
 *
 * O `publicId` tem barras (`maison-essence/products/asad-9f3a`), e barra crua
 * na URL viraria outro segmento de rota. `encodeURIComponent` transforma cada
 * uma em `%2F`, que nao casa com o separador na hora de escolher a rota — e
 * o Express entrega o valor ja decodificado do outro lado.
 *
 * O servidor recusa quando a imagem ainda esta em uso por um produto, uma
 * categoria ou um banner, e diz em quantos de cada.
 */
export function deleteUpload(publicId: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/admin/uploads/${encodeURIComponent(publicId)}`, {
    scope: SESSION_SCOPES.ADMIN,
    ...(signal ? { signal } : {}),
  });
}

/**
 * A frase de erro do Cloudinary, quando ela existe.
 *
 * O corpo de erro deles e `{ error: { message } }`, mas nem toda falha chega
 * como JSON — um 413 da borda vem como HTML. Por isso a leitura e defensiva e
 * termina numa frase nossa, que diz o que fazer, em vez de um status seco.
 */
async function cloudinaryMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body.error?.message;

    if (typeof message === 'string' && message !== '') {
      return message;
    }
  } catch {
    // Corpo que nao e JSON: cai na frase padrao abaixo.
  }

  return response.status === 413
    ? 'A imagem e grande demais para o servidor de fotos.'
    : 'O servidor de fotos recusou o envio. Tente de novo em instantes.';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
