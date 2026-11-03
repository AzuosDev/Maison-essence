/**
 * O plano que a loja contratou na operadora: o padrão ou o Nitro.
 *
 * O Nitro antecipa o dinheiro — a venda parcelada cai na conta na hora, em
 * vez de mes a mes — e cobra mais caro por isso, em toda a tabela e nas duas
 * modalidades. E uma chave que a dona liga e desliga no aplicativo conforme o
 * caixa aperta, e não uma mudanca de contrato.
 *
 * Por que isto escolhe uma tabela inteira e não multiplica a outra: as duas
 * tabelas são publicadas pela operadora, linha a linha, e a diferença entre
 * elas não e um fator — em 1x o Nitro cobra 5,99% contra 4,20%, e em 12x
 * 18,79% contra 16,66%. Guardar as duas e copiar cada uma do aplicativo e a
 * única forma de a conta bater.
 *
 * Por que são duas tabelas guardadas, e não uma que se reescreve ao ligar o
 * Nitro: ligar e desligar e uma decisão de fluxo de caixa, tomada e desfeita
 * na mesma semana. Reescrever faria cada ida e volta custar vinte e quatro
 * células digitadas de novo, e a primeira volta já não teria os valores
 * antigos para onde voltar.
 *
 * Isto não aparece no checkout em lugar nenhum. Quando a loja recebe e custo
 * dela; o que chega ao cliente e o preço, que já sai calculado pela tabela em
 * uso.
 */
export const CARD_PLANS = {
  STANDARD: 'standard',
  NITRO: 'nitro',
} as const;

export type CardPlan = (typeof CARD_PLANS)[keyof typeof CARD_PLANS];

export const CARD_PLAN_VALUES: readonly CardPlan[] = Object.values(CARD_PLANS);
