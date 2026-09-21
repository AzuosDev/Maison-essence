import { Types } from 'mongoose';
import { citiesOf, isDefaultAt, planAddresses } from './customer-addresses.js';
import type { CustomerAddressDto } from './dto/update-customer.dto.js';

function address(data: Partial<CustomerAddressDto> = {}): CustomerAddressDto {
  return { street: 'Rua das Flores', district: 'Centro', ...data };
}

describe('planAddresses', () => {
  it('preserva o id do endereco que ja existe', () => {
    const id = new Types.ObjectId().toHexString();
    const { addresses, unknown } = planAddresses([address({ id })], [id]);

    expect(String(addresses[0]?._id)).toBe(id);
    expect(unknown).toEqual([]);
  });

  it('da id novo ao endereco que chega sem um', () => {
    const { addresses } = planAddresses([address()], []);

    expect(Types.ObjectId.isValid(String(addresses[0]?._id))).toBe(true);
  });

  it('acusa o id que nao e da conta', () => {
    const meu = new Types.ObjectId().toHexString();
    const alheio = new Types.ObjectId().toHexString();
    const { unknown } = planAddresses([address({ id: alheio })], [meu]);

    expect(unknown).toEqual([alheio]);
  });

  it('completa com vazio o que o formulario nao preencheu', () => {
    const [gravado] = planAddresses([address()], []).addresses;

    expect(gravado).toMatchObject({
      label: '',
      cityId: null,
      number: '',
      complement: '',
      zipCode: '',
      reference: '',
    });
  });

  it('remover um endereco e manda-lo de fora da lista', () => {
    const fica = new Types.ObjectId().toHexString();
    const sai = new Types.ObjectId().toHexString();
    const { addresses } = planAddresses([address({ id: fica })], [fica, sai]);

    expect(addresses).toHaveLength(1);
    expect(String(addresses[0]?._id)).toBe(fica);
  });
});

describe('isDefaultAt', () => {
  it('sem ninguem marcado, o primeiro e o padrao', () => {
    const lista = [address(), address({ street: 'Rua B' })];

    expect([isDefaultAt(lista, 0), isDefaultAt(lista, 1)]).toEqual([true, false]);
  });

  it('respeita o que o cliente marcou', () => {
    const lista = [address(), address({ isDefault: true })];

    expect([isDefaultAt(lista, 0), isDefaultAt(lista, 1)]).toEqual([false, true]);
  });

  it('com dois marcados, o primeiro vence e o outro perde a marca', () => {
    // Duas casas padrao fariam o checkout escolher no escuro.
    const lista = [address({ isDefault: true }), address({ isDefault: true })];

    expect([isDefaultAt(lista, 0), isDefaultAt(lista, 1)]).toEqual([true, false]);
  });

  it('lista vazia nao tem padrao', () => {
    expect(isDefaultAt([], 0)).toBe(false);
  });
});

describe('citiesOf', () => {
  it('junta as cidades citadas, sem repetir', () => {
    const cidade = new Types.ObjectId().toHexString();
    const lista = [address({ cityId: cidade }), address({ cityId: cidade }), address()];

    expect(citiesOf(lista)).toEqual([cidade]);
  });

  it('nenhum endereco com cidade, nenhuma consulta a fazer', () => {
    expect(citiesOf([address()])).toEqual([]);
  });
});
