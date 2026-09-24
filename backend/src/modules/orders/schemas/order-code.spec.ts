import { ORDER_CODE_PATTERN, generateOrderCode } from './order-code.js';

describe('generateOrderCode', () => {
  it('segue o formato ME-AAMMDD-XXXX', () => {
    expect(generateOrderCode()).toMatch(ORDER_CODE_PATTERN);
  });

  it('usa a data do fuso da loja, não a UTC da função', () => {
    // 21/09 as 02:30 em UTC ainda e dia 20 no Brasil. O código precisa bater
    // com o horário que a dona vê na mensagem do WhatsApp.
    const code = generateOrderCode(new Date('2026-09-21T02:30:00Z'));

    expect(code.startsWith('ME-260920-')).toBe(true);
  });

  it('usa base36 em caixa alta na parte aleatória', () => {
    const random = generateOrderCode().split('-')[2];

    expect(random).toMatch(/^[0-9A-Z]{4}$/);
  });

  it('quase não repete o código em sequência', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateOrderCode()));

    // 1,6 milhão de combinações por dia (36^4). Pelo paradoxo do aniversário,
    // 500 sorteios colidem em cerca de 7% das rodadas — exigir 500 distintos
    // seria um teste que falha sozinho de vez em quando. O que importa e a
    // ordem de grandeza; a colisão que sobrar morre no índice único.
    expect(codes.size).toBeGreaterThanOrEqual(495);
  });
});
