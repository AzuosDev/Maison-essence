import type { PublicCard } from './payments.types';

/**
 * O parcelamento, calculado no cliente.
 *
 * A conta e a mesma de `payments/installments.ts` no backend, e a igualdade e
 * o ponto: o "3x de R$ 66,33" do card precisa ser exatamente o que o checkout
 * vai oferecer e o que a mensagem do WhatsApp vai registrar. Duas contas
 * parecidas viram uma discussão com o cliente na hora de cobrar.
 *
 * ## Quem usa o que daqui
 *
 * `bestInterestFreeInstallment` e da vitrine: o card e a página do produto
 * anunciam só a parcela **sem juros**, que depende de três números que vem de
 * `GET /payment-settings` uma vez por visita. Vinte produtos numa tela, cada
 * um com o seu preço, não justificam uma ida ao servidor por produto.
 *
 * `buildInstallmentOptions` e do painel. As parcelas com taxa que o cliente
 * vê saem da cotação, calculadas no servidor; esta copia existe para a prévia
 * do painel mostrar a lista mudando enquanto a dona digita a tabela, antes de
 * salvar — e por isso ela precisa arredondar igual ao servidor. Prévia que
 * arredonda diferente e pior do que prévia nenhuma: ela da confiança num
 * número errado.
 *
 * Tudo em centavos inteiros.
 */

export interface Installment {
  /** Quantidade de parcelas. Sempre dois ou mais. */
  count: number;
  /** O valor que se repete — o número que vem depois do "x". */
  installmentCents: number;
}

/**
 * A melhor parcela sem juros que cabe num preço, ou `null` quando não cabe
 * nenhuma.
 *
 * Melhor e a maior: "12x de R$ 41,58" convence mais que "2x de R$ 249,50", e
 * as duas custam o mesmo. A busca desce do teto sem juros até 2x e para na
 * primeira que respeita a parcela mínima — a regra que existe para impedir
 * "12x de R$ 1,25" numa vela de R$ 15.
 *
 * `Math.floor`, e não `Math.round`, como no backend: e o que garante que a
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
 * As regras que o cálculo consome. Espelho de `InstallmentRules` no backend.
 *
 * `feePercents` e um mapa, e não uma lista indexada, porque "não ha taxa
 * cadastrada para 11x" precisa ser diferente de "a taxa de 11x e zero". A
 * primeira esconde a opção; a segunda a oferece sem acréscimo.
 */
export interface InstallmentRules {
  maxInstallments: number;
  /** Até aqui a loja absorve a taxa, e o cliente paga o preço de etiqueta. */
  interestFreeUpTo: number;
  feePercents: ReadonlyMap<number, number>;
  minInstallmentCents: number;
}

/**
 * Uma opção de parcelamento inteira, com a taxa repassada quando houver.
 *
 * `installmentCents` e o valor que se repete — o número depois do "x".
 * `firstInstallmentCents` e a primeira, que carrega a sobra do arredondamento
 * e por isso pode vir alguns centavos maior: dividir R$ 100 em três da três
 * vezes R$ 33,33, que somam R$ 99,99, e o centavo que falta precisa estar em
 * algum lugar. O lugar menos pior e a parcela que o cliente paga hoje,
 * olhando para o total, e não a que ele paga daqui a onze meses.
 */
export interface InstallmentOption {
  /** Quantidade de parcelas. Começa em 1 — o a vista no cartão. */
  count: number;
  installmentCents: number;
  firstInstallmentCents: number;
  /** Quanto o cliente paga no fim. Igual ao total a vista quando não há juros. */
  totalCents: number;
  hasInterest: boolean;
}

/**
 * Todas as opções de parcelamento de um total.
 *
 * Copia fiel de `buildInstallmentOptions` do backend, incluindo os dois
 * motivos de uma opção não existir: a parcela que cai abaixo do mínimo e a
 * taxa que não esta cadastrada acima do limite absorvido.
 */
export function buildInstallmentOptions(
  totalCents: number,
  rules: InstallmentRules,
): InstallmentOption[] {
  const options: InstallmentOption[] = [];

  for (let count = 1; count <= rules.maxInstallments; count += 1) {
    const option = optionFor(totalCents, count, rules);

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
 * recusar o pagamento a vista de um pedido de R$ 15 porque o mínimo e R$ 20
 * seria recusar a venda — a regra existe para impedir "12x de R$ 1,25", e não
 * para impedir compra pequena no cartão.
 *
 * Dentro do limite absorvido a tabela nem e consultada: lá o cliente paga a
 * etiqueta venha o que vier, e uma linha faltando não pode derrubar a venda
 * a vista.
 */
function optionFor(
  totalCents: number,
  count: number,
  rules: InstallmentRules,
): InstallmentOption | null {
  const absorbed = count <= rules.interestFreeUpTo;
  const feePercent = absorbed ? 0 : rules.feePercents.get(count);

  if (feePercent === undefined) {
    return null;
  }

  const hasInterest = feePercent > 0;
  const financedCents = hasInterest ? grossUp(totalCents, feePercent) : totalCents;

  // `floor` e não `round`: e o que garante que a sobra seja sempre positiva e
  // caiba na primeira parcela, em vez de faltar centavo no fim.
  const installmentCents = Math.floor(financedCents / count);

  if (count > 1 && installmentCents < rules.minInstallmentCents) {
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
 * O valor cobrado do cliente para a loja receber `netCents` limpos.
 *
 * `cobrado = liquido / (1 - taxa)`, a mesma formula da calculadora da
 * maquininha. Multiplicar por `1 + taxa` e o erro que parece dar certo: a
 * taxa incide sobre o valor **cobrado**, não sobre o liquido.
 */
export function grossUp(netCents: number, feePercent: number): number {
  if (feePercent <= 0 || feePercent >= 100) {
    return netCents;
  }

  return Math.round(netCents / (1 - feePercent / 100));
}

/**
 * Quanto a loja recebe de uma venda, depois da taxa.
 *
 * O contrario de `grossUp`, e a conta que o cliente nunca vê: ela existe para
 * a prévia do painel mostrar o preço de absorver a taxa. "Sem juros até 3x" e
 * uma frase simpática na vitrine e uma linha no extrato.
 */
export function netOf(chargedCents: number, feePercent: number): number {
  if (feePercent <= 0 || feePercent >= 100) {
    return chargedCents;
  }

  return Math.round(chargedCents * (1 - feePercent / 100));
}
