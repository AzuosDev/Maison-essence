/**
 * Regras do carrossel da home.
 *
 * Funções puras, longe do Mongoose, porque são elas que decidem o que o
 * cliente vê: qual banner esta no ar agora e em que ordem. Testa-las sem
 * banco e o que permite escrever o caso "promoção que terminou ontem" sem
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
 * O início e inclusivo e o fim e exclusivo: `endsAt` e o instante em que o
 * banner *sai*, não o último em que aparece. E como a dona pensa ao agendar
 * o Natal — "até dia 25" significa que no dia 26, a zero hora, a arte já
 * saiu do ar.
 *
 * `isActive` e o desligamento manual, independente do agendamento: serve
 * para tirar a arte do ar agora sem perder as datas que já foram escolhidas.
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
 * Se o período de exibição faz sentido.
 *
 * Um banner que termina antes de começar nunca apareceria, e o painel
 * silenciosamente mostraria uma campanha salva que ninguém veria. Vale só
 * quando as duas datas existem: uma ponta aberta significa "desde sempre" ou
 * "até segunda ordem".
 */
export function hasValidWindow(banner: Pick<ScheduledBanner, 'startsAt' | 'endsAt'>): boolean {
  if (banner.startsAt === null || banner.endsAt === null) {
    return true;
  }

  return banner.endsAt.getTime() > banner.startsAt.getTime();
}

/**
 * Ids citados pelo painel que não são de banner nenhum.
 *
 * O PATCH manda o array inteiro do carrossel, e banner com `id` e banner que
 * já existe — manter o `id` e o que preserva a identidade da imagem entre
 * gravações. Id desconhecido quase sempre significa que outra pessoa apagou
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
