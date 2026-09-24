import { formatBrazilianPhone, normalizeBrazilianPhone } from './phone.js';

describe('normalizeBrazilianPhone', () => {
  it('aceita o número como o teclado do celular sugere', () => {
    expect(normalizeBrazilianPhone('(88) 99999-9999')).toBe('88999999999');
  });

  it('aceita o número colado de um contato salvo, com o pais', () => {
    expect(normalizeBrazilianPhone('+55 (88) 99999-9999')).toBe('88999999999');
  });

  it('aceita só os digitos', () => {
    expect(normalizeBrazilianPhone('88999999999')).toBe('88999999999');
  });

  it('recusa fixo de oito digitos', () => {
    // O pedido vai para o WhatsApp: número que não recebe WhatsApp não serve.
    expect(normalizeBrazilianPhone('8836110000')).toBeNull();
  });

  it('recusa celular sem o nono digito', () => {
    expect(normalizeBrazilianPhone('88 8888-8888')).toBeNull();
  });

  it('recusa DDD que não existe', () => {
    expect(normalizeBrazilianPhone('08999999999')).toBeNull();
    expect(normalizeBrazilianPhone('80999999999')).toBeNull();
  });

  it('recusa número com letra', () => {
    expect(normalizeBrazilianPhone('88 9999-ABCD')).toBeNull();
  });

  it('recusa o que não e texto', () => {
    expect(normalizeBrazilianPhone(88_999_999_999)).toBeNull();
    expect(normalizeBrazilianPhone(undefined)).toBeNull();
  });

  it('recusa número longo demais para ser brasileiro', () => {
    expect(normalizeBrazilianPhone('55889999999999')).toBeNull();
  });
});

describe('formatBrazilianPhone', () => {
  it('escreve o número como se lê', () => {
    expect(formatBrazilianPhone('88999999999')).toBe('(88) 99999-9999');
  });

  it('devolve intacto o que não esta no formato guardado', () => {
    expect(formatBrazilianPhone('')).toBe('');
  });
});
