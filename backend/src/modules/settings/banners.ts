/**
 * Regras do carrossel da home.
 *
 * Funcoes puras, longe do Mongoose, porque sao elas que decidem o que o
 * cliente ve: qual banner esta no ar agora e em que ordem. Testa-las sem
 * banco e o que permite escrever o caso "promocao que terminou ontem" sem
 * montar um documento inteiro.
 */

/** O que basta saber de um banner para decidir se ele esta no ar. */
export interface ScheduledBanner {
  order: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * Se o banner esta no ar neste instante.
 *
 * O inicio e inclusivo e o fim e exclusivo: `endsAt` e o instante em que o
 * banner *sai*, nao o ultimo em que aparece. E como a dona pensa ao agendar
 * o Natal — "ate dia 25" significa que no dia 26, a zero hora, a arte ja
 * saiu do ar.
 *
 * `isActive` e o desligamento manual, independente do agendamento: serve
 * para tirar a arte do ar agora sem perder as datas que ja foram escolhidas.
 */
export function isBannerLive(banner: ScheduledBanner, now: Date): boolean {
  if (!banner.isActive) {
    return false;
  }

  const instant = now.getTime();

  if (banner.startsAt !== null && banner.startsAt.getTime() > instant) {
    return false;
  }

  return banner.endsAt === null || banner.endsAt.getTime() > instant;
}

/** Os banners vigentes, na ordem em que a home deve exibi-los. */
export function liveBanners<T extends ScheduledBanner>(
  banners: readonly T[],
  now: Date,
): T[] {
  return banners
    .filter((banner) => isBannerLive(banner, now))
    .sort((first, second) => first.order - second.order);
}

/**
 * Se o periodo de exibicao faz sentido.
 *
 * Um banner que termina antes de comecar nunca apareceria, e o painel
 * silenciosamente mostraria uma campanha salva que ninguem veria. Vale so
 * quando as duas datas existem: uma ponta aberta significa "desde sempre" ou
 * "ate segunda ordem".
 */
export function hasValidWindow(banner: Pick<ScheduledBanner, 'startsAt' | 'endsAt'>): boolean {
  if (banner.startsAt === null || banner.endsAt === null) {
    return true;
  }

  return banner.endsAt.getTime() > banner.startsAt.getTime();
}

/**
 * Ids citados pelo painel que nao sao de banner nenhum.
 *
 * O PATCH manda o array inteiro do carrossel, e banner com `id` e banner que
 * ja existe — manter o `id` e o que preserva a identidade da imagem entre
 * gravacoes. Id desconhecido quase sempre significa que outra pessoa apagou
 * o banner enquanto esta tela estava aberta, e sobrescrever nesse estado
 * ressuscitaria o que acabou de ser removido.
 */
export function unknownBannerIds(
  incoming: readonly { id?: string }[],
  existingIds: readonly string[],
): string[] {
  const known = new Set(existingIds);

  return incoming
    .map((banner) => banner.id)
    .filter((id): id is string => id !== undefined && !known.has(id));
}
