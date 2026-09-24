/**
 * As formas de pagamento que a loja aberta anuncia.
 *
 * Espelho de `PublicPaymentSettingsView` do backend. Nenhum pagamento e
 * processado pelo sistema: a dona combina a cobrança pelo WhatsApp. O que
 * esta aqui e o que a vitrine precisa para escrever "em até 3x sem juros" no
 * card e para montar as opções do checkout.
 *
 * Os dois blocos são `null` quando a forma não e aceita, em vez de virem
 * acompanhados de um `acceptsCard: false`. Desligar o cartão no painel faz a
 * opção sumir da resposta, e a tela não tem como exibir por engano um
 * parcelamento que a loja não oferece — não há o que exibir.
 */

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

/** O que a loja aberta sabe sobre o PIX. A chave nunca vem nesta resposta. */
export interface PublicPix {
  keyType: PixKeyType;
  /** Sem chave configurada, o PIX não pode ser oferecido. */
  hasKey: boolean;
  discountPercent: number;
}

/** As regras de parcelamento no cartão. */
export interface PublicCard {
  maxInstallments: number;
  /** Até aqui, divisão simples. Acima, tabela price. */
  interestFreeUpTo: number;
  monthlyInterestPercent: number;
  /** Opção cuja parcela cai abaixo disto não e oferecida. */
  minInstallmentCents: number;
}

export interface PublicPaymentSettings {
  pix: PublicPix | null;
  card: PublicCard | null;
}
