/**
 * Regras da faixa de cartazes de coleção.
 *
 * Funções puras, longe do Mongoose, pelo mesmo motivo de `banners.ts` e
 * `shortcuts.ts`: elas decidem o que a cliente vê no meio da home, e testar o
 * caso "cartaz desligado" sem banco é o que mantém o teste legível.
 *
 * São gêmeas das de `shortcuts.ts` e não as mesmas de propósito. A semelhança
 * é real — as duas listas são linhas ordenáveis com interruptor —, mas uni-las
 * numa função só amarraria dois desenhos que mudam por motivos diferentes: o
 * dia em que o cartaz ganhar agendamento, como o banner tem, a fileira de
 * círculos não ganha nada.
 */

/** O que basta saber de um cartaz para decidir se ele entra na faixa. */
export interface OrderedPoster {
  order: number;
  isActive: boolean;
}

/**
 * Os cartazes vigentes, na ordem em que a home deve desenhá-los.
 *
 * Sem agendamento, como os atalhos: o cartaz é navegação destacada, e não
 * campanha com começo e fim. O corte final pelo par acontece na vitrine, que
 * é quem sabe que a faixa são duas colunas.
 */
export function livePosters<T extends OrderedPoster>(posters: readonly T[]): T[] {
  return posters
    .filter((poster) => poster.isActive)
    .sort((first, second) => first.order - second.order);
}

/**
 * Ids citados pelo painel que não são de cartaz nenhum.
 *
 * Mesma regra do carrossel e dos atalhos: o PATCH manda a faixa inteira, e
 * cartaz com `id` é cartaz que já existe — é o `id` que preserva a identidade
 * da arte entre gravações, e é por ele que o módulo de uploads sabe que a
 * imagem ainda está em uso. Id desconhecido quase sempre significa que outra
 * pessoa apagou o cartaz enquanto esta tela estava aberta.
 */
export function unknownPosterIds(
  incoming: readonly { id?: string }[],
  existingIds: readonly string[],
): string[] {
  const known = new Set(existingIds);

  return incoming
    .map((poster) => poster.id)
    .filter((id): id is string => id !== undefined && !known.has(id));
}
