/**
 * O cálculo do parcelamento, em funções puras.
 *
 * Nenhum pagamento e processado pelo sistema: o cliente escolhe a forma, a
 * mensagem do WhatsApp registra o que foi combinado e a cobrança acontece
 * fora daqui. Ainda assim esta conta precisa fechar no centavo, porque e ela
 * que vira a frase "12x de R$ 92,58" na tela e na mensagem — e uma soma de
 * parcelas que não bate com o total e uma discussão com o cliente na hora de
 * cobrar.
 *
 * Tudo em centavos inteiros, do começo ao fim. Ponto flutuante aparece uma
 * única vez, no expoente da tabela price, e o resultado e arredondado para
 * inteiro antes de qualquer outra coisa acontecer com ele.
 */

/** As regras de `PaymentSettings` que o cálculo precisa conhecer. */
export interface InstallmentRules {
  maxInstallments: number;
  /** Até aqui, divisão simples. Acima, tabela price. */
  interestFreeUpTo: number;
  /** Juros ao mês, em percentual. Fracionário: 1,99 e um valor corrente. */
  monthlyInterestPercent: number;
  /** Opções cuja parcela cai abaixo disto são omitidas. */
  minInstallmentCents: number;
}

/**
 * Uma opção de parcelamento.
 *
 * `installmentCents` e o valor que se repete — e o número que a tela mostra
 * depois do "x". `firstInstallmentCents` e a primeira parcela, que carrega a
 * diferença de arredondamento e por isso pode ser alguns centavos maior.
 *
 * As duas existem porque `totalCents` precisa ser exatamente a soma das
 * parcelas: dividir R$ 100 em três da R$ 33,33, e três vezes R$ 33,33 são
 * R$ 99,99. O centavo que falta tem que estar em algum lugar, e o lugar menos
 * pior e a primeira parcela — a que o cliente paga hoje, olhando para o
 * total, e não daqui a onze meses, quando já esqueceu a conta.
 */
export interface InstallmentOption {
  /** Quantidade de parcelas. */
  number: number;
  installmentCents: number;
  firstInstallmentCents: number;
  /** Quanto o cliente paga no fim. Igual ao total a vista quando não há juros. */
  totalCents: number;
  hasInterest: boolean;
}

/**
 * As opções de parcelamento de um total.
 *
 * A lista começa em 1x — o pagamento a vista no cartão — e vai até
 * `maxInstallments`, pulando o que a parcela mínima proibir.
 */
export function buildInstallmentOptions(
  totalCents: number,
  rules: InstallmentRules,
): InstallmentOption[] {
  const options: InstallmentOption[] = [];

  for (let number = 1; number <= rules.maxInstallments; number += 1) {
    const option = optionFor(totalCents, number, rules);

    if (option !== null) {
      options.push(option);
    }
  }

  return options;
}

/**
 * Uma opção, ou `null` quando ela não pode ser oferecida.
 *
 * A parcela mínima vale a partir de 2x. Em 1x não há parcela: há o preço, e
 * recusar o pagamento a vista de um pedido de R$ 15 porque o mínimo de
 * parcela e R$ 20 seria recusar a venda — a regra existe para impedir "12x de
 * R$ 1,25", não para impedir compra pequena no cartão.
 */
function optionFor(
  totalCents: number,
  number: number,
  rules: InstallmentRules,
): InstallmentOption | null {
  const hasInterest = number > rules.interestFreeUpTo && rules.monthlyInterestPercent > 0;
  const financedCents = hasInterest
    ? priceTotal(totalCents, number, rules.monthlyInterestPercent)
    : totalCents;

  // `floor` e não `round`: e o que garante que a sobra seja sempre positiva e
  // caiba na primeira parcela, em vez de faltar centavo no fim.
  const installmentCents = Math.floor(financedCents / number);

  if (number > 1 && installmentCents < rules.minInstallmentCents) {
    return null;
  }

  return {
    number,
    installmentCents,
    firstInstallmentCents: financedCents - installmentCents * (number - 1),
    totalCents: financedCents,
    hasInterest,
  };
}

/**
 * O total financiado pela tabela price, em centavos inteiros.
 *
 * `PMT = PV * i / (1 - (1 + i)^-n)` — a parcela fixa que quita o principal com
 * juros compostos ao mês. O total e a parcela vezes o número de parcelas,
 * arredondado uma vez só: arredondar a parcela antes de multiplicar espalha o
 * erro por todas elas, e o total deixa de bater com o que o cliente somou na
 * calculadora.
 *
 * Com juros zerados a formula vira `0 / 0`. O caso não chega aqui pelo
 * caminho normal, porque `optionFor` só financia quando há taxa, mas a função
 * e exportada e quem a chamar de outro lugar merece receber o valor a vista e
 * não um `NaN` que só aparece três somas adiante.
 */
export function priceTotal(
  presentValueCents: number,
  number: number,
  monthlyInterestPercent: number,
): number {
  if (monthlyInterestPercent <= 0) {
    return presentValueCents;
  }

  const rate = monthlyInterestPercent / 100;
  const installment = (presentValueCents * rate) / (1 - (1 + rate) ** -number);

  return Math.round(installment * number);
}
