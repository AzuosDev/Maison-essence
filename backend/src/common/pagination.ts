/**
 * Página de resultados, no formato que o painel e a vitrine consomem.
 *
 * `hasMore` vai junto de propósito, mesmo saindo de uma conta que o cliente
 * poderia fazer: e o que a lista com scroll infinito da loja pergunta, e
 * deixar a conta no servidor evita que duas telas a facam de jeitos
 * diferentes.
 */
export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
}

export function paginate<T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number,
): Paginated<T> {
  // Uma página sempre, mesmo vazia: "página 1 de 0" não quer dizer nada na tela.
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return { items, page, totalPages, totalItems, hasMore: page < totalPages };
}

/** Quantos documentos pular para chegar na página pedida. */
export function skipFor(page: number, limit: number): number {
  return (page - 1) * limit;
}
