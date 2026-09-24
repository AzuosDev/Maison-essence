import { formatCents } from './money.js';

describe('formatCents', () => {
  it('escreve o valor como a loja o exibe', () => {
    expect(formatCents(1000)).toBe('R$ 10,00');
    expect(formatCents(1999)).toBe('R$ 19,99');
    expect(formatCents(0)).toBe('R$ 0,00');
  });

  it('mantem os centavos com duas casas', () => {
    expect(formatCents(5)).toBe('R$ 0,05');
    expect(formatCents(150)).toBe('R$ 1,50');
  });

  it('separa os milhares com ponto', () => {
    expect(formatCents(150_000)).toBe('R$ 1.500,00');
    expect(formatCents(99_999_999)).toBe('R$ 999.999,99');
  });

  // O espaço depois do "R$" e um espaço comum, e não o estreito sem quebra do
  // ICU: este texto vai para a mensagem do WhatsApp, onde um caractere
  // invisível só aparece quando o cliente reclama.
  it('usa espaço comum entre o símbolo e o número', () => {
    expect(formatCents(1000).charCodeAt(2)).toBe(32);
  });
});
