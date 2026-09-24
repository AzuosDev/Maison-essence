import { expect, test } from 'vitest';
import type { AddressForm } from './account.schema';
import type { AccountAddress, AddressInput } from './account.types';
import { addAddress, editAddress, makeDefault, removeAddress, toInputs } from './address-list';

/**
 * Os enderecos salvos, como lista.
 *
 * Toda acao da tela vira um `PATCH /customer/me` com a lista inteira, e o
 * que estes casos protegem e a unica regra que nao perdoa distracao:
 * **exatamente um endereco marcado como padrao, e ele e o que a pessoa
 * escolheu**.
 *
 * O servidor resolveria empates sozinho — o primeiro marcado vence, e sem
 * ninguem marcado o primeiro assume —, mas resolveria em silencio: a tela
 * mandaria dois marcados e a lista voltaria diferente do que estava na tela.
 */

function saved(over: Partial<AccountAddress> = {}): AccountAddress {
  return {
    id: 'a1',
    label: 'Casa',
    cityId: null,
    street: 'Rua das Flores',
    number: '120',
    complement: '',
    district: 'Centro',
    zipCode: '63010-000',
    reference: '',
    isDefault: false,
    ...over,
  };
}

function form(over: Partial<AddressForm> = {}): AddressForm {
  return {
    label: 'Trabalho',
    cityId: '',
    street: 'Avenida Leão Sampaio',
    number: '900',
    complement: '',
    district: 'Lagoa Seca',
    zipCode: '',
    reference: '',
    isDefault: false,
    ...over,
  };
}

/** Quais posicoes estao marcadas. Uma so deve voltar em toda operacao. */
function defaults(list: readonly AddressInput[]): number[] {
  return list.flatMap((address, index) => (address.isDefault ? [index] : []));
}

test('a cidade ausente não vira string vazia no corpo', () => {
  // `exactOptionalPropertyTypes` a parte, o backend valida `cityId` como
  // ObjectId quando ele esta presente: mandar `''` seria um 400 por um campo
  // que a pessoa deliberadamente deixou em branco.
  const [first] = toInputs([saved({ cityId: null })]);

  expect(first).not.toHaveProperty('cityId');
  expect(toInputs([saved({ cityId: 'c1' })])[0]?.cityId).toBe('c1');
});

test('o primeiro endereço da conta e padrão mesmo sem a caixa marcada', () => {
  // A caixa nem aparece na tela nesse caso. Uma lista sem padrao faria cada
  // tela decidir sozinha qual usar, e elas decidiriam diferente.
  const list = addAddress([], form({ isDefault: false }));

  expect(list).toHaveLength(1);
  expect(defaults(list)).toEqual([0]);
});

test('endereço novo sem marcar não rouba o padrão de quem já tinha', () => {
  const list = addAddress(toInputs([saved({ isDefault: true })]), form());

  expect(defaults(list)).toEqual([0]);
});

test('endereço novo marcado assume, e o antigo perde a marca', () => {
  const list = addAddress(toInputs([saved({ isDefault: true })]), form({ isDefault: true }));

  expect(defaults(list)).toEqual([1]);
});

test('marcar um endereço desmarca todos os outros', () => {
  const list = makeDefault(
    toInputs([saved({ id: 'a1', isDefault: true }), saved({ id: 'a2' }), saved({ id: 'a3' })]),
    'a3',
  );

  expect(defaults(list)).toEqual([2]);
});

test('editar preserva o id, que e o que liga o endereço ao que esta gravado', () => {
  // Sem o id, o servidor trataria a edicao como um endereco novo e o antigo
  // sumiria — e um pedido que aponta para ele ficaria orfao.
  const list = editAddress(toInputs([saved({ id: 'a1' })]), 'a1', form({ street: 'Rua Nova' }));

  expect(list[0]?.id).toBe('a1');
  expect(list[0]?.street).toBe('Rua Nova');
});

test('desmarcar o padrão na edição promove outro, e não deixa a lista sem nenhum', () => {
  const list = editAddress(
    toInputs([saved({ id: 'a1', isDefault: true }), saved({ id: 'a2' })]),
    'a1',
    form({ isDefault: false }),
  );

  expect(defaults(list)).toEqual([1]);
});

test('desmarcar o padrão quando ele e o único não tira a marca de ninguém', () => {
  const list = editAddress(
    toInputs([saved({ id: 'a1', isDefault: true })]),
    'a1',
    form({ isDefault: false }),
  );

  expect(defaults(list)).toEqual([0]);
});

test('editar um endereço que sumiu entre abrir e salvar não o ressuscita', () => {
  // Outra aba o excluiu. Gravar a lista com ele de volta desfaria uma
  // exclusao que a pessoa fez de proposito.
  const current = toInputs([saved({ id: 'a1', isDefault: true })]);
  const list = editAddress(current, 'sumiu', form());

  expect(list.map((address) => address.id)).toEqual(['a1']);
});

test('excluir o padrão promove o primeiro que sobrou', () => {
  const list = removeAddress(
    toInputs([saved({ id: 'a1', isDefault: true }), saved({ id: 'a2' }), saved({ id: 'a3' })]),
    'a1',
  );

  expect(list.map((address) => address.id)).toEqual(['a2', 'a3']);
  expect(defaults(list)).toEqual([0]);
});

test('excluir quem não era padrão não mexe em quem era', () => {
  const list = removeAddress(
    toInputs([saved({ id: 'a1' }), saved({ id: 'a2', isDefault: true })]),
    'a1',
  );

  expect(defaults(list)).toEqual([0]);
  expect(list[0]?.id).toBe('a2');
});

test('excluir o último devolve lista vazia, e não uma lista com um fantasma', () => {
  expect(removeAddress(toInputs([saved({ id: 'a1', isDefault: true })]), 'a1')).toEqual([]);
});

test('nenhuma operação deixa mais de um marcado', () => {
  // A garantia que o servidor nao precisa desempatar. Duas marcas fariam a
  // lista voltar diferente do que a pessoa acabou de ver.
  const bagunca = toInputs([
    saved({ id: 'a1', isDefault: true }),
    saved({ id: 'a2', isDefault: true }),
    saved({ id: 'a3', isDefault: true }),
  ]);

  expect(defaults(makeDefault(bagunca, 'a2'))).toHaveLength(1);
  expect(defaults(removeAddress(bagunca, 'a1'))).toHaveLength(1);
  expect(defaults(addAddress(bagunca, form()))).toHaveLength(1);
  expect(defaults(editAddress(bagunca, 'a2', form()))).toHaveLength(1);
});
