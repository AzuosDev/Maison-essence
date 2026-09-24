import { Types } from 'mongoose';
import type { CustomerAddressDto } from './dto/update-customer.dto.js';

/**
 * A regra dos endereços salvos, em função pura.
 *
 * Longe do Mongoose porque o que decide identidade e padrão não precisa de
 * banco para ser conferido: os casos que importam são de lista — endereço que
 * volta com `id` e precisa manter o mesmo `_id`, dois marcados como padrão,
 * nenhum marcado, `id` que não e da conta.
 */

/** O resultado do planejamento: o que gravar e o que não pertence a conta. */
export interface AddressPlan {
  /** Endereços prontos para o `set`, na ordem em que vieram. */
  addresses: Record<string, unknown>[];
  /** `id`s enviados que não estão na conta. Vazio no caminho normal. */
  unknown: string[];
}

/**
 * Monta a lista que vai substituir a gravada.
 *
 * O `_id` de cada endereço e preservado quando o formulário manda o `id`:
 * corrigir o número da casa não pode fazer o endereço trocar de identidade,
 * porque e por ela que a tela sabe qual cartão editar e que um pedido antigo
 * aponta. Endereço sem `id` e novo e ganha o seu.
 */
export function planAddresses(
  incoming: readonly CustomerAddressDto[],
  knownIds: readonly string[],
): AddressPlan {
  const known = new Set(knownIds);

  return {
    unknown: incoming
      .map((address) => address.id)
      .filter((id): id is string => id !== undefined && !known.has(id)),
    addresses: incoming.map((address, index) => ({
      _id: address.id === undefined ? new Types.ObjectId() : new Types.ObjectId(address.id),
      label: address.label ?? '',
      cityId: address.cityId === undefined ? null : new Types.ObjectId(address.cityId),
      street: address.street,
      number: address.number ?? '',
      complement: address.complement ?? '',
      district: address.district,
      zipCode: address.zipCode ?? '',
      reference: address.reference ?? '',
      isDefault: isDefaultAt(incoming, index),
    })),
  };
}

/**
 * Qual endereço fica marcado como padrão.
 *
 * O primeiro marcado vence e os outros perdem a marca: duas casas padrão
 * fariam o checkout escolher no escuro. Se nenhum veio marcado, o primeiro da
 * lista assume — uma lista sem padrão obrigaria cada tela a decidir sozinha, e
 * elas decidiriam diferente uma da outra.
 */
export function isDefaultAt(
  addresses: readonly CustomerAddressDto[],
  index: number,
): boolean {
  // Lista vazia não tem padrão. O `map` nunca chega aqui nesse caso, mas a
  // função e exportada e "o padrão e o índice 0" de uma lista sem índice 0
  // seria uma resposta errada esperando quem a chamasse de outro lugar.
  if (addresses.length === 0) {
    return false;
  }

  const marked = addresses.findIndex((address) => address.isDefault === true);

  return index === (marked === -1 ? 0 : marked);
}

/** As cidades citadas, sem repetir. Vazio quando nenhum endereço escolheu uma. */
export function citiesOf(addresses: readonly CustomerAddressDto[]): string[] {
  return [
    ...new Set(
      addresses.map((address) => address.cityId).filter((id): id is string => id !== undefined),
    ),
  ];
}
