/**
 * Os dados legais da loja.
 *
 * ## Atenção: o CNPJ abaixo e um marcador, não o número real
 *
 * `GET /settings` não devolve CNPJ nem razão social — esses campos não
 * existem no `StoreSettings` do backend. O rodapé precisa deles por
 * exigência do Código de Defesa do Consumidor, então estão aqui, em
 * constante, até que uma das duas coisas aconteca:
 *
 * 1. o backend ganhe os campos e o rodapé passe a lê-los de `settings`; ou
 * 2. alguém substitua os valores abaixo pelos verdadeiros.
 *
 * Deixar um CNPJ inventado no ar e pior do que não mostrar nenhum: e
 * informação legal falsa na página de uma loja que vende. Por isso o rodapé
 * só desenha a linha quando `LEGAL.cnpj` não esta vazio — e ele nasce vazio.
 */
export const LEGAL = {
  /** Razão social. Vazio esconde a linha. */
  companyName: '',
  /** `00.000.000/0001-00`. Vazio esconde a linha. */
  cnpj: '',
} as const;
