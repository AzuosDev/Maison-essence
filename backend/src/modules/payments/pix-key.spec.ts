import { PIX_KEY_TYPES } from '../../common/enums/payment-method.js';
import { normalizePixKey } from './pix-key.js';

describe('normalizePixKey', () => {
  it('aceita vazio: e a loja que ainda nao configurou a chave', () => {
    expect(normalizePixKey('', PIX_KEY_TYPES.EMAIL)).toBe('');
    expect(normalizePixKey('   ', PIX_KEY_TYPES.CPF)).toBe('');
  });

  describe('CPF e CNPJ', () => {
    it('tira a pontuacao que vem colada do aplicativo do banco', () => {
      expect(normalizePixKey('123.456.789-09', PIX_KEY_TYPES.CPF)).toBe('12345678909');
      expect(normalizePixKey('12.345.678/0001-95', PIX_KEY_TYPES.CNPJ)).toBe('12345678000195');
    });

    it('recusa quantidade de digitos que nao e a do documento', () => {
      expect(normalizePixKey('1234567890', PIX_KEY_TYPES.CPF)).toBeNull();
      expect(normalizePixKey('12345678909', PIX_KEY_TYPES.CNPJ)).toBeNull();
    });

    it('recusa letra no meio', () => {
      expect(normalizePixKey('123.456.78X-09', PIX_KEY_TYPES.CPF)).toBeNull();
    });
  });

  describe('telefone', () => {
    it('acrescenta o pais e guarda com o sinal, como o PIX registra', () => {
      expect(normalizePixKey('(88) 99999-9999', PIX_KEY_TYPES.PHONE)).toBe('+5588999999999');
    });

    it('deixa passar quem ja veio com o pais', () => {
      expect(normalizePixKey('+55 88 99999-9999', PIX_KEY_TYPES.PHONE)).toBe('+5588999999999');
    });

    it('recusa numero curto demais para ter DDD', () => {
      expect(normalizePixKey('99999999', PIX_KEY_TYPES.PHONE)).toBeNull();
    });
  });

  describe('e-mail', () => {
    it('guarda em minuscula', () => {
      expect(normalizePixKey('  Contato@MaisonEssence.com.br ', PIX_KEY_TYPES.EMAIL)).toBe(
        'contato@maisonessence.com.br',
      );
    });

    it('recusa o que nao e endereco', () => {
      expect(normalizePixKey('contato arroba maison', PIX_KEY_TYPES.EMAIL)).toBeNull();
      expect(normalizePixKey('contato@maison', PIX_KEY_TYPES.EMAIL)).toBeNull();
    });
  });

  describe('chave aleatoria', () => {
    it('aceita o codigo que o banco gera', () => {
      expect(normalizePixKey('3F2B1C4D-5E6F-4A7B-8C9D-0E1F2A3B4C5D', PIX_KEY_TYPES.RANDOM)).toBe(
        '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      );
    });

    it('recusa codigo truncado', () => {
      expect(normalizePixKey('3f2b1c4d-5e6f-4a7b', PIX_KEY_TYPES.RANDOM)).toBeNull();
    });
  });

  /**
   * O erro que esta validacao existe para pegar: a chave certa com o tipo
   * errado. A rota publica anuncia so o tipo, entao o cliente leria "chave:
   * CPF" e digitaria onze digitos — e a transferencia nao aconteceria.
   */
  it('recusa a chave que nao corresponde ao tipo escolhido', () => {
    expect(normalizePixKey('contato@maisonessence.com.br', PIX_KEY_TYPES.CPF)).toBeNull();
    expect(normalizePixKey('12345678909', PIX_KEY_TYPES.EMAIL)).toBeNull();
  });
});
