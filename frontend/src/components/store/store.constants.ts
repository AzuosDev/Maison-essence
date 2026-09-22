/**
 * Os dados legais da loja.
 *
 * ## Atencao: o CNPJ abaixo e um marcador, nao o numero real
 *
 * `GET /settings` nao devolve CNPJ nem razao social — esses campos nao
 * existem no `StoreSettings` do backend. O rodape precisa deles por
 * exigencia do Codigo de Defesa do Consumidor, entao estao aqui, em
 * constante, ate que uma das duas coisas aconteca:
 *
 * 1. o backend ganhe os campos e o rodape passe a le-los de `settings`; ou
 * 2. alguem substitua os valores abaixo pelos verdadeiros.
 *
 * Deixar um CNPJ inventado no ar e pior do que nao mostrar nenhum: e
 * informacao legal falsa na pagina de uma loja que vende. Por isso o rodape
 * so desenha a linha quando `LEGAL.cnpj` nao esta vazio — e ele nasce vazio.
 */
export const LEGAL = {
  /** Razao social. Vazio esconde a linha. */
  companyName: '',
  /** `00.000.000/0001-00`. Vazio esconde a linha. */
  cnpj: '',
} as const;
