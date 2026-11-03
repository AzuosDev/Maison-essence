import { buildInstallmentOptions, grossUp, netOf } from './installments.js';
import type { InstallmentOption, InstallmentRules } from './installments.js';

/** A tabela do link, como a operadora a publica. */
const LINK_RATES = new Map([
  [1, 4.2],
  [2, 6.09],
  [3, 7.01],
  [4, 7.91],
  [5, 8.8],
  [6, 9.67],
  [7, 12.59],
  [8, 13.42],
  [9, 14.25],
  [10, 15.06],
  [11, 15.87],
  [12, 16.66],
]);

/** As regras padrão da loja: 12x, três absorvidas, mínimo de R$ 20. */
const RULES: InstallmentRules = {
  maxInstallments: 12,
  interestFreeUpTo: 3,
  feePercents: LINK_RATES,
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

  it('divide sem juros até o limite que a loja absorve', () => {
    const options = buildInstallmentOptions(100_000, rules());
    const semJuros = options.filter((option) => !option.hasInterest);

    expect(numbersOf(semJuros)).toEqual([1, 2, 3]);
    // Absorvida a taxa, o que o cliente paga no fim e o preço do produto.
    expect(semJuros.every((option) => option.totalCents === 100_000)).toBe(true);
  });

  it('repassa a taxa da parcela acima do limite', () => {
    const options = buildInstallmentOptions(100_000, rules());
    const seis = options.find((option) => option.number === 6);

    // R$ 1.000 a 9,67%: a loja recebe os R$ 1.000 inteiros porque o cliente
    // paga 1000 / (1 - 0,0967).
    expect(seis).toEqual({
      number: 6,
      installmentCents: 18_450,
      // A primeira carrega os cinco centavos que a divisão deixou.
      firstInstallmentCents: 18_455,
      totalCents: 110_705,
      hasInterest: true,
    });
  });

  /**
   * O degrau que nenhuma formula de juros reproduz, e a razão de a tabela ser
   * dado cadastrado: de 6x para 7x a taxa pula de 9,67% para 12,59%, e o
   * total da sétima sobe mais do que a sexta inteira subiu sobre a quinta.
   */
  it('acompanha o degrau da tabela entre 6x e 7x', () => {
    const options = buildInstallmentOptions(100_000, rules());
    const totals = new Map(options.map((option) => [option.number, option.totalCents]));

    expect(totals.get(5)).toBe(109_649);
    expect(totals.get(6)).toBe(110_705);
    expect(totals.get(7)).toBe(114_403);

    const degrau = (totals.get(7) ?? 0) - (totals.get(6) ?? 0);
    const passoAnterior = (totals.get(6) ?? 0) - (totals.get(5) ?? 0);

    expect(degrau).toBeGreaterThan(passoAnterior * 3);
  });

  it('taxa zerada não cria juros acima do limite', () => {
    const livre = new Map([...LINK_RATES.keys()].map((number) => [number, 0]));
    const options = buildInstallmentOptions(100_000, rules({ feePercents: livre }));

    // Sem taxa, "acima do limite absorvido" não quer dizer nada: a divisão
    // continua simples e o total continua sendo o preço.
    expect(options.every((option) => !option.hasInterest)).toBe(true);
    expect(options.every((option) => option.totalCents === 100_000)).toBe(true);
  });

  /**
   * Linha que falta na tabela esconde a parcela, e não a oferece de graça.
   *
   * O erro barato: a dona vê a lista encurtada na prévia do painel e completa
   * a tabela. O caro seria a loja vender em 11x e descobrir no extrato que
   * pagou os 15,87% sozinha.
   */
  it('não oferece a parcela cuja taxa não esta cadastrada', () => {
    const faltando = new Map(LINK_RATES);
    faltando.delete(11);

    const options = buildInstallmentOptions(100_000, rules({ feePercents: faltando }));

    expect(numbersOf(options)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
  });

  it('a falta de taxa não derruba a parcela que a loja absorve', () => {
    const options = buildInstallmentOptions(100_000, rules({ feePercents: new Map() }));

    // Dentro do limite o cliente paga a etiqueta, e a tabela nem e
    // consultada: tabela vazia não pode tirar a venda a vista do ar.
    expect(numbersOf(options)).toEqual([1, 2, 3]);
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

          // Absorvida a taxa, o total da opção e o próprio preço: parcela
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

describe('grossUp', () => {
  it('devolve o valor que, menos a taxa, da o liquido desejado', () => {
    const cobrado = grossUp(100_000, 9.67);

    expect(cobrado).toBe(110_705);
    // A ida e volta fecha no centavo, e e ela que faz a dona receber
    // exatamente o preço de etiqueta.
    expect(netOf(cobrado, 9.67)).toBe(100_000);
  });

  /**
   * O erro que parece dar certo: somar a taxa em vez de dividir por ela. A
   * taxa incide sobre o valor cobrado, não sobre o liquido, e em 16,66% a
   * diferença entre os dois caminhos chega a R$ 9,99 num pedido de R$ 300 —
   * por venda, e sempre contra a loja.
   */
  it('cobra mais do que somar a taxa ao valor', () => {
    const certo = grossUp(30_000, 16.66);
    const errado = Math.round(30_000 * 1.1666);

    expect(certo).toBe(35_997);
    expect(certo - errado).toBe(999);
  });

  it('sem taxa, o valor cobrado e o próprio valor', () => {
    expect(grossUp(100_000, 0)).toBe(100_000);
  });

  /**
   * Taxa de 100% dividiria por zero. O schema a recusa muito antes daqui; a
   * guarda existe para um documento adulterado a mão virar uma venda sem
   * acréscimo, e não um `Infinity` que só aparece na mensagem do WhatsApp.
   */
  it('taxa impossível não vira infinito', () => {
    expect(grossUp(100_000, 100)).toBe(100_000);
    expect(grossUp(100_000, 150)).toBe(100_000);
  });
});

describe('netOf', () => {
  it('mostra quanto custa absorver a taxa', () => {
    // R$ 300 em 3x "sem juros" a 7,01%: a cliente paga R$ 300 e a loja
    // recebe R$ 278,97.
    expect(netOf(30_000, 7.01)).toBe(27_897);
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
