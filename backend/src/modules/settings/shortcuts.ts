/**
 * Regras da fileira de atalhos da home.
 *
 * Funções puras, longe do Mongoose, pelo mesmo motivo de `banners.ts`: são
 * elas que decidem o que a cliente vê na primeira tela, e testá-las sem banco
 * é o que permite escrever o caso "atalho desligado no meio da fileira" sem
 * montar um documento inteiro.
 */

/** O que basta saber de um atalho para decidir se ele entra na fileira. */
export interface OrderedShortcut {
  order: number;
  isActive: boolean;
}

/**
 * Os atalhos vigentes, na ordem em que a home deve desenhá-los.
 *
 * Não há agendamento aqui, e isso é decisão e não omissão: o banner é uma
 * campanha com começo e fim, e o atalho é navegação. Uma loja não agenda a
 * estreia do caminho para "Hidratantes" — ela o liga ou desliga. `isActive`
 * é o único interruptor, e o corte final pelo teto da fileira acontece na
 * vitrine, que é quem sabe quantos círculos cabem.
 */
export function liveShortcuts<T extends OrderedShortcut>(shortcuts: readonly T[]): T[] {
  return shortcuts
    .filter((shortcut) => shortcut.isActive)
    .sort((first, second) => first.order - second.order);
}

/**
 * Ids citados pelo painel que não são de atalho nenhum.
 *
 * Mesma regra do carrossel: o PATCH manda a fileira inteira, e atalho com
 * `id` é atalho que já existe — é o `id` que preserva a identidade da foto
 * entre gravações, e é por ele que o módulo de uploads sabe que a imagem
 * ainda está em uso. Id desconhecido quase sempre significa que outra pessoa
 * apagou o atalho enquanto esta tela estava aberta, e sobrescrever nesse
 * estado ressuscitaria o que acabou de ser removido.
 */
export function unknownShortcutIds(
  incoming: readonly { id?: string }[],
  existingIds: readonly string[],
): string[] {
  const known = new Set(existingIds);

  return incoming
    .map((shortcut) => shortcut.id)
    .filter((id): id is string => id !== undefined && !known.has(id));
}
