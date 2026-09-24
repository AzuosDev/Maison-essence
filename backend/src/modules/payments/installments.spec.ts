import { buildInstallmentOptions, priceTotal } from './installments.js';
import type { InstallmentOption, InstallmentRules } from './installments.js';

/** As regras padrão da loja: 12x, três sem juros, 1,99% ao mês, mínimo R$ 20. */
const RULES: InstallmentRules = {
  maxInstallments: 12,
  interestFreeUpTo: 3,
  monthlyInterestPercent: 1.99,
  minInstallmentCents: 2000,
};

function rules(overrides: Partial<InstallmentRules> = {}): InstallmentRules {
  return { ...RULES, ...overrides };
}

function numbersOf(options: readonly InstallmentOption[]): number[] {
  return options.map((option) => option.number);
}

describe('buildInstallmentOptions', () => {
  it('começa no pagamento a vista', () => {
    const [first] = buildInstallmentOptions(100_000, rules());

    expect(first).toEqual({
      number: 1,
      installmentCents: 100_000,
      firstInstallmentCents: 100_000,
      totalCents: 100_000,
      hasInterest: false,
    });
  });

  it('divide sem juros até o limite configurado', () => {
    const options = buildInstallmentOptions(100_000, rules());
    const semJuros = options.filter((option) => !option.hasInterest);

    expect(numbersOf(semJuros)).toEqual([1, 2, 3]);
    // Sem juros, o que o cliente paga no fim e o preço do produto.
    expect(semJuros.every((option) => option.totalCents === 100_000)).toBe(true);
  });

  it('aplica a tabela price acima do limite', () => {
    const options = buildInstallmentOptions(100_000, rules());
    const seis = options.find((option) => option.number === 6);

    expect(seis).toEqual({
      number: 6,
      installmentCents: 17_846,
      // A primeira carrega os três centavos que a divisão deixou.
      firstInstallmentCents: 17_849,
      totalCents: 107_079,
      hasInterest: true,
    });
  });

  it('juros zerados não criam juros acima do limite', () => {
    const options = buildInstallmentOptions(100_000, rules({ monthlyInterestPercent: 0 }));

    // Sem taxa, "acima do limite sem juros" não quer dizer nada: a divisão
    // continua simples e o total continua sendo o preço.
    expect(options.every((option) => !option.hasInterest)).toBe(true);
    expect(options.every((option) => option.totalCents === 100_000)).toBe(true);
  });

  describe('parcela mínima', () => {
    /**
     * Critério de aceite: 12 parcelas no máximo, mínimo de R$ 20, total de
     * R$ 100. A sexta parcela cairia abaixo de R$ 20 e por isso nem aparece.
     */
    it('R$ 100 em até 12x com mínimo de R$ 20 devolve 5 opções', () => {
      const options = buildInstallmentOptions(10_000, rules());

      expect(options).toHaveLength(5);
      expect(numbersOf(options)).toEqual([1, 2, 3, 4, 5]);
    });

    it('nenhuma parcela oferecida fica abaixo do mínimo', () => {
      const options = buildInstallmentOptions(10_000, rules());

      expect(options.every((option) => option.installmentCents >= 2000)).toBe(true);
    });

    /**
     * Em 1x não há parcela: há o preço. Recusar um pedido de R$ 15 porque a
     * parcela mínima e R$ 20 seria recusar a venda — a regra existe para
     * impedir "12x de R$ 1,25", não compra pequena no cartão.
     */
    it('mantem o pagamento a vista mesmo abaixo do mínimo', () => {
      const options = buildInstallmentOptions(1500, rules());

      expect(numbersOf(options)).toEqual([1]);
      expect(options[0].totalCents).toBe(1500);
    });
  });

  describe('arredondamento', () => {
    it('joga a diferença na primeira parcela', () => {
      const [, , tres] = buildInstallmentOptions(10_000, rules());

      // R$ 100 em 3x da R$ 33,33, e três vezes isso são R$ 99,99. O centavo
      // que falta esta na primeira.
      expect(tres.installmentCents).toBe(3333);
      expect(tres.firstInstallmentCents).toBe(3334);
      expect(tres.totalCents).toBe(10_000);
    });

    /**
     * A invariante que não pode quebrar nunca, em 50 totais diferentes: a
     * soma das parcelas e exatamente o total da opção, sem centavo sobrando
     * nem faltando.
     *
     * Os valores são pseudoaleatórios de semente fixa, e não `Math.random`:
     * uma falha aqui precisa ser reproduzível na máquina de quem for
     * conserta-lá, e teste que só quebra as vezes acaba sendo ignorado.
     */
    it('a soma das parcelas fecha com o total em 50 valores', () => {
      for (const total of pseudoRandomTotals(50)) {
        for (const option of buildInstallmentOptions(total, rules())) {
          const sum =
            option.firstInstallmentCents + option.installmentCents * (option.number - 1);

          expect({ total, number: option.number, sum }).toEqual({
            total,
            number: option.number,
            sum: option.totalCents,
          });

          // Sem juros, o total da opção e o próprio preço: o parcelamento
          // sem juros não pode custar um centavo a mais que o a vista.
          if (!option.hasInterest) {
            expect(option.totalCents).toBe(total);
          }
        }
      }
    });

    it('a sobra cabe na primeira parcela e nunca a inverte', () => {
      for (const total of pseudoRandomTotals(50)) {
        for (const option of buildInstallmentOptions(total, rules())) {
          const extra = option.firstInstallmentCents - option.installmentCents;

          // No máximo um centavo por parcela restante, e nunca negativo: a
          // primeira parcela e sempre a maior, jamais a menor.
          expect(extra).toBeGreaterThanOrEqual(0);
          expect(extra).toBeLessThan(option.number);
        }
      }
    });
  });
});

describe('priceTotal', () => {
  it('cobra mais quanto mais longe o pagamento for', () => {
    const seis = priceTotal(100_000, 6, 1.99);
    const doze = priceTotal(100_000, 12, 1.99);

    expect(seis).toBe(107_079);
    expect(doze).toBe(113_402);
    expect(doze).toBeGreaterThan(seis);
  });

  it('sem juros, o total financiado e o próprio valor', () => {
    expect(priceTotal(100_000, 12, 0)).toBe(100_000);
  });
});

/**
 * Totais entre R$ 1,00 e R$ 5.000,00, sempre os mesmos.
 *
 * Congruência linear simples: não precisa de qualidade estatística, precisa
 * de espalhar os restos de divisão — e o resto e o único lugar de onde o
 * centavo perdido poderia sair.
 */
function pseudoRandomTotals(count: number): number[] {
  let seed = 20_260_921;
  const totals: number[] = [];

  for (let index = 0; index < count; index += 1) {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    totals.push(100 + (seed % 499_901));
  }

  return totals;
}
