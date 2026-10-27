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

/**
 * O brinde por valor de compra.
 *
 * ## Atenção: isto não vem da API, e por isso nasce desligado
 *
 * A loja dá brinde a partir de um valor — e uma regra de negócio real, dita
 * pela dona. O que não existe ainda e o campo: `StoreSettings` não tem
 * `giftMinCents` nem `giftLabel`, e `POST /cart/quote` não sabe desta regra.
 *
 * Então ela mora aqui, nas mesmas condições do CNPJ acima: a régua da sacola
 * só desenha o degrau do brinde quando os dois campos estiverem preenchidos,
 * e eles nascem vazios. Uma promessa de brinde na tela que o pedido não
 * cumpre e pior do que nenhuma promessa.
 *
 * **Enquanto for constante, mudar o valor exige deploy.** Quando o backend
 * ganhar os campos, este objeto sai e a régua passa a ler de `settings`, do
 * mesmo jeito que já lê `freeShippingMinCents` — a troca e de uma linha no
 * `CartRewards`.
 */
export const GIFT = {
  /** Valor mínimo em centavos. `0` desliga o degrau. */
  minCents: 0,
  /** O que o cliente ganha, em uma linha. Vazio desliga o degrau. */
  label: '',
} as const;
