import { formatBrazilianPhone, normalizeBrazilianPhone } from './phone.js';

describe('normalizeBrazilianPhone', () => {
  it('aceita o numero como o teclado do celular sugere', () => {
    expect(normalizeBrazilianPhone('(88) 99999-9999')).toBe('88999999999');
  });

  it('aceita o numero colado de um contato salvo, com o pais', () => {
    expect(normalizeBrazilianPhone('+55 (88) 99999-9999')).toBe('88999999999');
  });

  it('aceita so os digitos', () => {
    expect(normalizeBrazilianPhone('88999999999')).toBe('88999999999');
  });

  it('recusa fixo de oito digitos', () => {
    // O pedido vai para o WhatsApp: numero que nao recebe WhatsApp nao serve.
    expect(normalizeBrazilianPhone('8836110000')).toBeNull();
  });

  it('recusa celular sem o nono digito', () => {
    expect(normalizeBrazilianPhone('88 8888-8888')).toBeNull();
  });

  it('recusa DDD que nao existe', () => {
    expect(normalizeBrazilianPhone('08999999999')).toBeNull();
    expect(normalizeBrazilianPhone('80999999999')).toBeNull();
  });

  it('recusa numero com letra', () => {
    expect(normalizeBrazilianPhone('88 9999-ABCD')).toBeNull();
  });

  it('recusa o que nao e texto', () => {
    expect(normalizeBrazilianPhone(88_999_999_999)).toBeNull();
    expect(normalizeBrazilianPhone(undefined)).toBeNull();
  });

  it('recusa numero longo demais para ser brasileiro', () => {
    expect(normalizeBrazilianPhone('55889999999999')).toBeNull();
  });
});

describe('formatBrazilianPhone', () => {
  it('escreve o numero como se le', () => {
    expect(formatBrazilianPhone('88999999999')).toBe('(88) 99999-9999');
  });

  it('devolve intacto o que nao esta no formato guardado', () => {
    expect(formatBrazilianPhone('')).toBe('');
  });
});
