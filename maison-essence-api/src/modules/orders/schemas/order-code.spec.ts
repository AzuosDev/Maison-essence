import { ORDER_CODE_PATTERN, generateOrderCode } from './order-code.js';

describe('generateOrderCode', () => {
  it('segue o formato ME-AAMMDD-XXXX', () => {
    expect(generateOrderCode()).toMatch(ORDER_CODE_PATTERN);
  });

  it('usa a data do fuso da loja, nao a UTC da funcao', () => {
    // 21/09 as 02:30 em UTC ainda e dia 20 no Brasil. O codigo precisa bater
    // com o horario que a dona ve na mensagem do WhatsApp.
    const code = generateOrderCode(new Date('2026-09-21T02:30:00Z'));

    expect(code.startsWith('ME-260920-')).toBe(true);
  });

  it('usa base36 em caixa alta na parte aleatoria', () => {
    const random = generateOrderCode().split('-')[2];

    expect(random).toMatch(/^[0-9A-Z]{4}$/);
  });

  it('quase nao repete o codigo em sequencia', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateOrderCode()));

    // 1,6 milhao de combinacoes por dia (36^4). Pelo paradoxo do aniversario,
    // 500 sorteios colidem em cerca de 7% das rodadas — exigir 500 distintos
    // seria um teste que falha sozinho de vez em quando. O que importa e a
    // ordem de grandeza; a colisao que sobrar morre no indice unico.
    expect(codes.size).toBeGreaterThanOrEqual(495);
  });
});
