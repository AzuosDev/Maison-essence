import { Types } from 'mongoose';
import type { CustomerAddressDto } from './dto/update-customer.dto.js';

/**
 * A regra dos enderecos salvos, em funcao pura.
 *
 * Longe do Mongoose porque o que decide identidade e padrao nao precisa de
 * banco para ser conferido: os casos que importam sao de lista — endereco que
 * volta com `id` e precisa manter o mesmo `_id`, dois marcados como padrao,
 * nenhum marcado, `id` que nao e da conta.
 */

/** O resultado do planejamento: o que gravar e o que nao pertence a conta. */
export interface AddressPlan {
  /** Enderecos prontos para o `set`, na ordem em que vieram. */
  addresses: Record<string, unknown>[];
  /** `id`s enviados que nao estao na conta. Vazio no caminho normal. */
  unknown: string[];
}

/**
 * Monta a lista que vai substituir a gravada.
 *
 * O `_id` de cada endereco e preservado quando o formulario manda o `id`:
 * corrigir o numero da casa nao pode fazer o endereco trocar de identidade,
 * porque e por ela que a tela sabe qual cartao editar e que um pedido antigo
 * aponta. Endereco sem `id` e novo e ganha o seu.
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
 * Qual endereco fica marcado como padrao.
 *
 * O primeiro marcado vence e os outros perdem a marca: duas casas padrao
 * fariam o checkout escolher no escuro. Se nenhum veio marcado, o primeiro da
 * lista assume — uma lista sem padrao obrigaria cada tela a decidir sozinha, e
 * elas decidiriam diferente uma da outra.
 */
export function isDefaultAt(
  addresses: readonly CustomerAddressDto[],
  index: number,
): boolean {
  // Lista vazia nao tem padrao. O `map` nunca chega aqui nesse caso, mas a
  // funcao e exportada e "o padrao e o indice 0" de uma lista sem indice 0
  // seria uma resposta errada esperando quem a chamasse de outro lugar.
  if (addresses.length === 0) {
    return false;
  }

  const marked = addresses.findIndex((address) => address.isDefault === true);

  return index === (marked === -1 ? 0 : marked);
}

/** As cidades citadas, sem repetir. Vazio quando nenhum endereco escolheu uma. */
export function citiesOf(addresses: readonly CustomerAddressDto[]): string[] {
  return [
    ...new Set(
      addresses.map((address) => address.cityId).filter((id): id is string => id !== undefined),
    ),
  ];
}
