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
 * ## Repasse de taxa, e não juros ao mês
 *
 * A conta aqui e a mesma que a maquininha faz, e ela não e um financiamento.
 * A operadora cobra **uma taxa única sobre a venda** por quantidade de
 * parcelas — 7,01% em 3x, 16,66% em 12x — e desconta tudo de uma vez. Para a
 * loja receber o valor cheio, o cliente paga `valor / (1 - taxa)`.
 *
 * Isso tem duas consequências que a tabela price não tinha. A taxa não cresce
 * de forma suave: entre 6x e 7x ela pula de 9,67% para 12,59%, e nenhuma
 * formula de juros compostos reproduz esse degrau — por isso a tabela e dado
 * cadastrado, e não um percentual que o código multiplica. E a taxa não
 * depende do tempo: ela e descontada na venda, hoje, qualquer que seja o
 * número de parcelas que o cliente leve para pagar.
 *
 * Tudo em centavos inteiros, do começo ao fim. Ponto flutuante aparece uma
 * única vez, na divisão do repasse, e o resultado e arredondado para inteiro
 * antes de qualquer outra coisa acontecer com ele.
 */

/** As regras de `PaymentSettings` que o cálculo precisa conhecer. */
export interface InstallmentRules {
  maxInstallments: number;
  /** Até aqui a loja absorve a taxa, e o cliente paga o preço de etiqueta. */
  interestFreeUpTo: number;
  /**
   * A taxa de cada quantidade de parcelas, em percentual, na modalidade
   * escolhida. Fracionária: 16,66% e o valor que a operadora publica.
   *
   * Um mapa, e não uma lista indexada, porque "não ha taxa cadastrada para
   * 11x" precisa ser diferente de "a taxa de 11x e zero". A primeira esconde
   * a opção; a segunda a oferece sem acréscimo.
   */
  feePercents: ReadonlyMap<number, number>;
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
 * `maxInstallments`, pulando o que a parcela mínima e a tabela de taxas
 * proibirem.
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
 * Dois motivos tiram uma opção da lista, e os dois são silenciosos de
 * propósito — o cliente não precisa saber por que 11x não aparece:
 *
 * A **parcela mínima**, valendo a partir de 2x. Em 1x não há parcela: há o
 * preço, e recusar o pagamento a vista de um pedido de R$ 15 porque o mínimo
 * de parcela e R$ 20 seria recusar a venda — a regra existe para impedir "12x
 * de R$ 1,25", não para impedir compra pequena no cartão.
 *
 * A **taxa que não esta cadastrada**, valendo acima do limite que a loja
 * absorve. Sem a taxa não da para calcular o repasse, e as duas saídas
 * possíveis são oferecer a parcela sem acréscimo — a loja pagando a conta
 * sem saber — ou não oferecer. A segunda e a que erra barato: a opção some
 * da tela e a dona descobre pela prévia do painel, que mostra a lista
 * encurtada no mesmo lugar onde ela digita a tabela.
 *
 * Dentro do limite absorvido a taxa não e consultada: lá o cliente paga o
 * preço de etiqueta venha o que vier, e uma linha faltando na tabela não
 * pode derrubar a venda a vista.
 */
function optionFor(
  totalCents: number,
  number: number,
  rules: InstallmentRules,
): InstallmentOption | null {
  const absorbed = number <= rules.interestFreeUpTo;
  const feePercent = absorbed ? 0 : rules.feePercents.get(number);

  if (feePercent === undefined) {
    return null;
  }

  const hasInterest = feePercent > 0;
  const financedCents = hasInterest ? grossUp(totalCents, feePercent) : totalCents;

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
 * O valor cobrado do cliente para a loja receber `netCents` limpos.
 *
 * `cobrado = liquido / (1 - taxa)`, a mesma formula que a calculadora da
 * maquininha mostra. Multiplicar por `1 + taxa` e o erro que parece dar certo:
 * a taxa incide sobre o valor **cobrado**, não sobre o liquido, e em 16,66%
 * a diferença entre os dois caminhos chega a R$ 9,99 num pedido de R$ 300
 * — por venda, e sempre contra a loja.
 *
 * Taxa zerada devolve o próprio valor — e o que acontece dentro do limite que
 * a loja absorve, e quem chamar esta função de fora merece receber o valor a
 * vista em vez de uma divisão por um.
 *
 * Taxa de 100% ou mais não existe em maquininha nenhuma e o schema a recusa
 * muito antes daqui; a guarda existe para que um documento adulterado a mão
 * no banco vire uma venda sem acréscimo, e não um `Infinity` que só aparece
 * três somas adiante, na mensagem do WhatsApp.
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
 * O contrario de `grossUp`, e a conta que não aparece para o cliente em lugar
 * nenhum: ela existe para a prévia do painel mostrar o preço da decisão de
 * absorver a taxa. "Sem juros até 3x" e uma frase simpática na vitrine e uma
 * linha no extrato — num pedido de R$ 300 em 3x a 7,01%, são R$ 21,03 que
 * saem do bolso da dona, e ela só vê isso se alguém mostrar.
 */
export function netOf(chargedCents: number, feePercent: number): number {
  if (feePercent <= 0 || feePercent >= 100) {
    return chargedCents;
  }

  return Math.round(chargedCents * (1 - feePercent / 100));
}
