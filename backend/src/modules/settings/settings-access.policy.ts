import { ForbiddenException } from '@nestjs/common';
import { USER_ROLES } from '../../common/enums/user-role.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

/**
 * Quais configurações são da operação e quais são da moldura da loja.
 *
 * `/admin/settings` e uma tela só, e por baixo dela moram duas coisas de
 * naturezas diferentes:
 *
 * - **a operação**: nome da loja, WhatsApp, e-mail, horário, barra de avisos,
 *   mínimo de frete grátis, retirada e endereço. Muda no expediente, por quem
 *   esta no expediente, e errar custa uma correção de um minuto.
 * - **a moldura**: o carrossel da home, o perfume da vez, as páginas que o
 *   rodapé lista, as redes sociais. São decisões de implantação, tomadas uma
 *   vez com quem mantem o sistema, e cada uma delas aparece em toda página
 *   da loja — uma página institucional despublicada tira do ar um link que já
 *   circula no WhatsApp de quem comprou.
 *
 * Por isso a divisão não e por rota, e por campo: o gerente abre a tela e
 * grava o que e da operação; o que e moldura ele lê e não grava. Um PATCH que
 * toca um campo de moldura e recusado inteiro, com 403, e nenhum campo do
 * corpo e gravado — não existe gravação pela metade aqui.
 *
 * Funções puras e uma lista nomeada, de propósito: campo novo em
 * `UpdateSettingsDto` que seja moldura entra nesta lista, e não num `if`
 * escondido no meio do serviço.
 */

/** Os campos de `/admin/settings` que só o SUPER_ADMIN grava. */
export const STORE_FRAME_FIELDS = [
  'banners',
  'featuredPerfumeProductId',
  'institutionalPages',
  'socialLinks',
] as const;

export type StoreFrameField = (typeof STORE_FRAME_FIELDS)[number];

/**
 * Como cada campo se chama na tela.
 *
 * A mensagem do 403 nomeia o que a pessoa tentou mexer, em vez de dizer só
 * "sem permissão": quem opera a loja precisa saber o que pedir a quem mantem
 * o sistema, e "não posso salvar" não e um pedido.
 */
const FIELD_LABELS: Record<StoreFrameField, string> = {
  banners: 'o carrossel da home',
  featuredPerfumeProductId: 'o perfume da vez',
  institutionalPages: 'as páginas do rodapé',
  socialLinks: 'as redes sociais',
};

/**
 * Os campos de moldura que este corpo tenta gravar.
 *
 * `!== undefined` e não `in`: campo ausente no JSON chega como `undefined`
 * depois do `class-transformer`, e `null` e valor de verdade em dois destes
 * campos — `featuredPerfumeProductId: null` devolve a escolha ao primeiro
 * destaque, que e uma edição da moldura como qualquer outra.
 */
export function frameFieldsIn(dto: UpdateSettingsDto): StoreFrameField[] {
  return STORE_FRAME_FIELDS.filter((field) => dto[field] !== undefined);
}

export function storeFrameMessage(fields: readonly StoreFrameField[]): string {
  const names = fields.map((field) => FIELD_LABELS[field]);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;

  return `Só o administrador altera ${list}. O resto desta tela esta liberado para você — peça esta mudança a quem mantem o sistema.`;
}

/**
 * Deixa passar o que este papel pode gravar nas configurações.
 *
 * O `@Roles` da rota já garantiu que quem chegou aqui opera a loja. O que
 * falta e a divisão por campo, que o decorator não sabe fazer.
 */
export function assertCanEditSettings(
  actor: AuthenticatedUser,
  dto: UpdateSettingsDto,
): void {
  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    return;
  }

  const fields = frameFieldsIn(dto);

  if (fields.length > 0) {
    throw new ForbiddenException(storeFrameMessage(fields));
  }
}
