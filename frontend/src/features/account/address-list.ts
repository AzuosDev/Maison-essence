import type { AddressForm } from './account.schema';
import type { AccountAddress, AddressInput } from './account.types';

/**
 * A lista de enderecos, editada como lista.
 *
 * ## Por que estas funcoes existem
 *
 * A API nao tem rota por endereco. Adicionar, editar, marcar como padrao e
 * excluir sao, todas, um `PATCH /customer/me` levando a **lista inteira**,
 * que substitui a gravada. O que a tela chama de "quatro acoes" o servidor
 * enxerga como quatro listas diferentes.
 *
 * Montar essas listas dentro dos manipuladores de clique significaria a
 * mesma regra escrita quatro vezes, e a regra tem um detalhe que nao perdoa
 * distracao — o padrao.
 *
 * ## O padrao: exatamente um, sempre
 *
 * O servidor resolve empates: o **primeiro marcado** vence e os outros
 * perdem a marca; se nenhum vier marcado, o primeiro da lista assume. Isso
 * evita banco inconsistente, mas e uma resolucao silenciosa — a tela
 * mandaria dois marcados, o servidor escolheria um, e a lista voltaria
 * diferente do que a pessoa acabou de ver.
 *
 * Entao a regra e aplicada aqui, antes de enviar: **exatamente um marcado**,
 * e ele e o que a pessoa escolheu. O servidor recebe uma lista que ja
 * concorda com a tela, e nao tem o que desempatar.
 *
 * ## Excluir o padrao promove alguem
 *
 * Explicitamente, e nao deixando o servidor promover por omissao. O efeito
 * e o mesmo; a diferenca e que a tela sabe de antemao quem vai assumir e
 * pode desenha-lo marcado no mesmo quadro.
 */

/** O endereco salvo, no formato que o `PATCH` recebe. */
export function toInputs(addresses: readonly AccountAddress[]): AddressInput[] {
  return addresses.map((address) => ({
    id: address.id,
    label: address.label,
    ...(address.cityId === null ? {} : { cityId: address.cityId }),
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    zipCode: address.zipCode,
    reference: address.reference,
    isDefault: address.isDefault,
  }));
}

/** O que o formulario devolveu, no formato do `PATCH`. */
function fromForm(values: AddressForm): AddressInput {
  return {
    label: values.label,
    ...(values.cityId === '' ? {} : { cityId: values.cityId }),
    street: values.street,
    number: values.number,
    complement: values.complement,
    district: values.district,
    zipCode: values.zipCode,
    reference: values.reference,
    isDefault: values.isDefault,
  };
}

/**
 * Deixa exatamente um marcado.
 *
 * `preferred` e o indice que deve ficar com a marca. `-1` significa "mantenha
 * quem ja esta marcado" — e, quando ninguem esta, o primeiro assume, que e a
 * mesma regra do servidor escrita deste lado.
 */
function normalize(list: readonly AddressInput[], preferred: number): AddressInput[] {
  if (list.length === 0) {
    return [];
  }

  const existing = list.findIndex((address) => address.isDefault);
  const marked = preferred >= 0 ? preferred : Math.max(existing, 0);

  return list.map((address, index) => ({ ...address, isDefault: index === marked }));
}

export function addAddress(current: readonly AddressInput[], values: AddressForm): AddressInput[] {
  const next = [...current, fromForm(values)];

  // O primeiro endereco de uma conta e padrao queira ou nao: nao ha outro
  // para disputar, e uma lista sem padrao faria cada tela decidir sozinha.
  const wantsDefault = values.isDefault || current.length === 0;

  return normalize(next, wantsDefault ? next.length - 1 : -1);
}

export function editAddress(
  current: readonly AddressInput[],
  id: string,
  values: AddressForm,
): AddressInput[] {
  const index = current.findIndex((address) => address.id === id);

  // O endereco sumiu entre abrir o formulario e salvar — outra aba o
  // excluiu. Gravar a lista sem ele seria ressuscita-lo; devolver a lista
  // como esta deixa a tela mostrar o que o servidor tem.
  if (index === -1) {
    return [...current];
  }

  const next = current.map((address, position) =>
    position === index ? { ...fromForm(values), id } : address,
  );

  if (values.isDefault) {
    return normalize(next, index);
  }

  // Desmarcou o que era o padrao. Alguem tem de assumir, e o criterio e o
  // mesmo do servidor: o primeiro da lista — que pode ser este mesmo, se
  // for o unico.
  const wasDefault = current[index]?.isDefault === true;

  return normalize(next, wasDefault ? firstOther(next, index) : -1);
}

export function makeDefault(current: readonly AddressInput[], id: string): AddressInput[] {
  return normalize(
    current,
    current.findIndex((address) => address.id === id),
  );
}

export function removeAddress(current: readonly AddressInput[], id: string): AddressInput[] {
  const removed = current.find((address) => address.id === id);
  const next = current.filter((address) => address.id !== id);

  // Saiu o padrao: o primeiro que sobrou assume, explicitamente. `-1` aqui
  // deixaria a lista sem marca nenhuma e o servidor promoveria por conta
  // propria — mesmo resultado, decidido onde a tela nao ve.
  return normalize(next, removed?.isDefault === true ? 0 : -1);
}

/** O primeiro indice diferente de `index`, ou o proprio quando e o unico. */
function firstOther(list: readonly AddressInput[], index: number): number {
  return list.length === 1 ? 0 : index === 0 ? 1 : 0;
}
