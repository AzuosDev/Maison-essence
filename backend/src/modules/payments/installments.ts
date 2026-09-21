/**
 * O calculo do parcelamento, em funcoes puras.
 *
 * Nenhum pagamento e processado pelo sistema: o cliente escolhe a forma, a
 * mensagem do WhatsApp registra o que foi combinado e a cobranca acontece
 * fora daqui. Ainda assim esta conta precisa fechar no centavo, porque e ela
 * que vira a frase "12x de R$ 92,58" na tela e na mensagem — e uma soma de
 * parcelas que nao bate com o total e uma discussao com o cliente na hora de
 * cobrar.
 *
 * Tudo em centavos inteiros, do comeco ao fim. Ponto flutuante aparece uma
 * unica vez, no expoente da tabela price, e o resultado e arredondado para
 * inteiro antes de qualquer outra coisa acontecer com ele.
 */

/** As regras de `PaymentSettings` que o calculo precisa conhecer. */
export interface InstallmentRules {
  maxInstallments: number;
  /** Ate aqui, divisao simples. Acima, tabela price. */
  interestFreeUpTo: number;
  /** Juros ao mes, em percentual. Fracionario: 1,99 e um valor corrente. */
  monthlyInterestPercent: number;
  /** Opcoes cuja parcela cai abaixo disto sao omitidas. */
  minInstallmentCents: number;
}

/**
 * Uma opcao de parcelamento.
 *
 * `installmentCents` e o valor que se repete — e o numero que a tela mostra
 * depois do "x". `firstInstallmentCents` e a primeira parcela, que carrega a
 * diferenca de arredondamento e por isso pode ser alguns centavos maior.
 *
 * As duas existem porque `totalCents` precisa ser exatamente a soma das
 * parcelas: dividir R$ 100 em tres da R$ 33,33, e tres vezes R$ 33,33 sao
 * R$ 99,99. O centavo que falta tem que estar em algum lugar, e o lugar menos
 * pior e a primeira parcela — a que o cliente paga hoje, olhando para o
 * total, e nao daqui a onze meses, quando ja esqueceu a conta.
 */
export interface InstallmentOption {
  /** Quantidade de parcelas. */
  number: number;
  installmentCents: number;
  firstInstallmentCents: number;
  /** Quanto o cliente paga no fim. Igual ao total a vista quando nao ha juros. */
  totalCents: number;
  hasInterest: boolean;
}

/**
 * As opcoes de parcelamento de um total.
 *
 * A lista comeca em 1x — o pagamento a vista no cartao — e vai ate
 * `maxInstallments`, pulando o que a parcela minima proibir.
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
 * Uma opcao, ou `null` quando ela nao pode ser oferecida.
 *
 * A parcela minima vale a partir de 2x. Em 1x nao ha parcela: ha o preco, e
 * recusar o pagamento a vista de um pedido de R$ 15 porque o minimo de
 * parcela e R$ 20 seria recusar a venda — a regra existe para impedir "12x de
 * R$ 1,25", nao para impedir compra pequena no cartao.
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

  // `floor` e nao `round`: e o que garante que a sobra seja sempre positiva e
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
 * juros compostos ao mes. O total e a parcela vezes o numero de parcelas,
 * arredondado uma vez so: arredondar a parcela antes de multiplicar espalha o
 * erro por todas elas, e o total deixa de bater com o que o cliente somou na
 * calculadora.
 *
 * Com juros zerados a formula vira `0 / 0`. O caso nao chega aqui pelo
 * caminho normal, porque `optionFor` so financia quando ha taxa, mas a funcao
 * e exportada e quem a chamar de outro lugar merece receber o valor a vista e
 * nao um `NaN` que so aparece tres somas adiante.
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
