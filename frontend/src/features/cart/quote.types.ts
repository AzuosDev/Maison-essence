/**
 * A cotacao, como `POST /cart/quote` a devolve.
 *
 * Espelho de `quote.view.ts` e `cart-lines.ts` do backend, escrito a mao
 * porque as duas pastas sao projetos separados.
 *
 * Esta e a **unica** fonte de dinheiro da sacola. Nao ha preco no
 * `localStorage`, nao ha preco no estado do Zustand, e nenhuma tela
 * multiplica quantidade por valor: todo numero em reais que o cliente ve no
 * carrinho veio de um destes campos, calculado no servidor, contra o
 * catalogo de agora.
 */

/**
 * Uma linha cotada.
 *
 * A linha indisponivel volta na resposta, e nao some: quem esta com o item
 * na sacola precisa ver qual deles saiu e por que. Ela vale zero em
 * `lineTotalCents`, e e so isso que a mantem fora das somas.
 */
export interface QuoteLine {
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  /** `publicId` do Cloudinary: o da variante, ou a capa do produto. */
  image: string;
  quantity: number;
  /** O preco de hoje, lido do banco. */
  unitPriceCents: number;
  /** Quanto ainda ha em estoque, para a sacola limitar a quantidade. */
  availableStock: number;
  /** Venda sob encomenda: a linha vale mesmo com o estoque no zero. */
  allowBackorder: boolean;
  discountPercent: number;
  discountCents: number;
  /** `unitPriceCents * quantity` menos o desconto. Zero quando indisponivel. */
  lineTotalCents: number;
  unavailable: boolean;
  /** Por que a linha saiu. Vazio quando ela esta valendo. */
  unavailableReason: string;
}

/** A entrega resolvida: taxa, motivo da isencao e quanto falta para ela. */
export interface QuoteFulfillment {
  mode: 'delivery' | 'pickup';
  cityId: string | null;
  cityName: string;
  state: string;
  estimatedDays: number;
  requiresAddress: boolean;
  feeCents: number;
  isFree: boolean;
  /** Por que nao ha taxa. Vazio quando ha. */
  freeReason: string;
  /** "Faltam R$ 30,00 para o frete gratis". `null` quando nao ha regra. */
  missingForFreeCents: number | null;
}

export interface InstallmentOption {
  number: number;
  installmentCents: number;
  firstInstallmentCents: number;
  totalCents: number;
  hasInterest: boolean;
}

export interface QuotePayment {
  method: 'pix' | 'card';
  installments: number;
  selected: InstallmentOption | null;
}

export interface CartQuote {
  items: QuoteLine[];
  fulfillment: QuoteFulfillment;
  payment: QuotePayment;
  /** Soma das linhas disponiveis, ja com o desconto por quantidade aplicado. */
  subtotalCents: number;
  /** Quanto o desconto por quantidade retirou. Ja saiu do subtotal. */
  discountTotalCents: number;
  deliveryFeeCents: number;
  pixDiscountCents: number;
  totalCents: number;
  installmentOptions: InstallmentOption[];
  /**
   * O que o cliente precisa saber antes de fechar.
   *
   * A sacola **nao** repete esta lista na tela, e a decisao esta explicada
   * em `cart-notices.ts`: ela mistura recados de item com recados de
   * pagamento e de entrega, e a sacola nao escolheu nem um nem outro. O que
   * ela mostra sai das proprias linhas.
   */
  warnings: string[];
}
