/**
 * As formas de pagamento que a loja aberta anuncia.
 *
 * Espelho de `PublicPaymentSettingsView` do backend. Nenhum pagamento e
 * processado pelo sistema: a dona combina a cobranca pelo WhatsApp. O que
 * esta aqui e o que a vitrine precisa para escrever "em ate 3x sem juros" no
 * card e para montar as opcoes do checkout.
 *
 * Os dois blocos sao `null` quando a forma nao e aceita, em vez de virem
 * acompanhados de um `acceptsCard: false`. Desligar o cartao no painel faz a
 * opcao sumir da resposta, e a tela nao tem como exibir por engano um
 * parcelamento que a loja nao oferece — nao ha o que exibir.
 */

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

/** O que a loja aberta sabe sobre o PIX. A chave nunca vem nesta resposta. */
export interface PublicPix {
  keyType: PixKeyType;
  /** Sem chave configurada, o PIX nao pode ser oferecido. */
  hasKey: boolean;
  discountPercent: number;
}

/** As regras de parcelamento no cartao. */
export interface PublicCard {
  maxInstallments: number;
  /** Ate aqui, divisao simples. Acima, tabela price. */
  interestFreeUpTo: number;
  monthlyInterestPercent: number;
  /** Opcao cuja parcela cai abaixo disto nao e oferecida. */
  minInstallmentCents: number;
}

export interface PublicPaymentSettings {
  pix: PublicPix | null;
  card: PublicCard | null;
}
