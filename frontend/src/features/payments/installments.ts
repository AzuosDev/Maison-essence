import type { PublicCard } from './payments.types';

/**
 * A linha de parcelamento do card, calculada no cliente.
 *
 * A conta e a mesma de `payments/installments.ts` no backend, e a igualdade e
 * o ponto: o "3x de R$ 66,33" do card precisa ser exatamente o que o checkout
 * vai oferecer e o que a mensagem do WhatsApp vai registrar. Duas contas
 * parecidas viram uma discussao com o cliente na hora de cobrar.
 *
 * Por que refazer a conta aqui em vez de pedir a parcela pronta: a rota de
 * cotacao precisa da sacola montada, e o card e uma vitrine — vinte produtos
 * numa tela, cada um com o seu preco. As regras sao quatro numeros que vem de
 * `GET /payment-settings` uma vez por visita; a aritmetica em cima deles nao
 * justifica uma ida ao servidor por produto.
 *
 * Tudo em centavos inteiros. O card so anuncia parcela **sem juros** — o
 * financiamento pela tabela price fica na pagina do produto e no checkout,
 * onde ha espaco para mostrar o total financiado ao lado.
 */

export interface Installment {
  /** Quantidade de parcelas. Sempre dois ou mais. */
  count: number;
  /** O valor que se repete — o numero que vem depois do "x". */
  installmentCents: number;
}

/**
 * A melhor parcela sem juros que cabe num preco, ou `null` quando nao cabe
 * nenhuma.
 *
 * Melhor e a maior: "12x de R$ 41,58" convence mais que "2x de R$ 249,50", e
 * as duas custam o mesmo. A busca desce do teto sem juros ate 2x e para na
 * primeira que respeita a parcela minima — a regra que existe para impedir
 * "12x de R$ 1,25" numa vela de R$ 15.
 *
 * `Math.floor`, e nao `Math.round`, como no backend: e o que garante que a
 * sobra de arredondamento seja positiva e caiba na primeira parcela, em vez
 * de faltar centavo no fim.
 */
export function bestInterestFreeInstallment(
  totalCents: number,
  card: PublicCard,
): Installment | null {
  const ceiling = Math.min(card.interestFreeUpTo, card.maxInstallments);

  for (let count = ceiling; count >= 2; count -= 1) {
    const installmentCents = Math.floor(totalCents / count);

    if (installmentCents >= card.minInstallmentCents) {
      return { count, installmentCents };
    }
  }

  return null;
}

/**
 * Uma opcao de parcelamento inteira, com juros quando houver.
 *
 * `installmentCents` e o valor que se repete — o numero depois do "x".
 * `firstInstallmentCents` e a primeira, que carrega a sobra do arredondamento
 * e por isso pode vir alguns centavos maior: dividir R$ 100 em tres da tres
 * vezes R$ 33,33, que somam R$ 99,99, e o centavo que falta precisa estar em
 * algum lugar. O lugar menos pior e a parcela que o cliente paga hoje,
 * olhando para o total, e nao a que ele paga daqui a onze meses.
 */
export interface InstallmentOption {
  /** Quantidade de parcelas. Comeca em 1 — o a vista no cartao. */
  count: number;
  installmentCents: number;
  firstInstallmentCents: number;
  /** Quanto o cliente paga no fim. Igual ao total a vista quando nao ha juros. */
  totalCents: number;
  hasInterest: boolean;
}

/**
 * Todas as opcoes de parcelamento de um total.
 *
 * Copia fiel de `buildInstallmentOptions` do backend, e a fidelidade e o
 * ponto: e esta lista que o painel mostra a dona quando ela mexe nos juros, e
 * ela precisa ser exatamente a que o checkout vai oferecer. Uma previa que
 * arredonda diferente do servidor e pior do que previa nenhuma — ela da
 * confianca num numero errado.
 *
 * A lista comeca em 1x e vai ate `maxInstallments`, pulando o que a parcela
 * minima proibir.
 */
export function buildInstallmentOptions(totalCents: number, card: PublicCard): InstallmentOption[] {
  const options: InstallmentOption[] = [];

  for (let count = 1; count <= card.maxInstallments; count += 1) {
    const option = optionFor(totalCents, count, card);

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
 * recusar o pagamento a vista de um pedido de R$ 15 porque o minimo e R$ 20
 * seria recusar a venda — a regra existe para impedir "12x de R$ 1,25", e nao
 * para impedir compra pequena no cartao.
 */
function optionFor(totalCents: number, count: number, card: PublicCard): InstallmentOption | null {
  const hasInterest = count > card.interestFreeUpTo && card.monthlyInterestPercent > 0;
  const financedCents = hasInterest
    ? priceTotal(totalCents, count, card.monthlyInterestPercent)
    : totalCents;

  // `floor` e nao `round`: e o que garante que a sobra seja sempre positiva e
  // caiba na primeira parcela, em vez de faltar centavo no fim.
  const installmentCents = Math.floor(financedCents / count);

  if (count > 1 && installmentCents < card.minInstallmentCents) {
    return null;
  }

  return {
    count,
    installmentCents,
    firstInstallmentCents: financedCents - installmentCents * (count - 1),
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
 * Com juros zerados a formula vira `0 / 0`, e o valor a vista e a resposta
 * certa — quem chamar esta funcao de fora merece recebe-lo, e nao um `NaN`
 * que so aparece tres somas adiante.
 */
export function priceTotal(
  presentValueCents: number,
  count: number,
  monthlyInterestPercent: number,
): number {
  if (monthlyInterestPercent <= 0) {
    return presentValueCents;
  }

  const rate = monthlyInterestPercent / 100;
  const installment = (presentValueCents * rate) / (1 - (1 + rate) ** -count);

  return Math.round(installment * count);
}
