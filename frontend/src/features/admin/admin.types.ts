/**
 * O painel como a API o entrega.
 *
 * Espelho das views administrativas do backend, escrito a mao porque as duas
 * pastas sao projetos separados. A diferenca para os tipos da loja nao e
 * cosmetica: aqui aparecem `sku`, `isActive`, `stock` real e as anotacoes
 * internas do pedido — tudo o que a vitrine nunca ve.
 *
 * As datas chegam como texto ISO. Nao sao convertidas para `Date` na
 * fronteira de proposito: o que a tela faz com elas e formatar e comparar, e
 * as duas coisas funcionam no texto ordenavel que o JSON ja traz.
 */

import type { PixKeyType } from '@/features/payments';

/* ---- Paginacao ---------------------------------------------------------- */

export interface AdminPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
}

/** O teto que `MAX_PAGE_SIZE` impoe nas listagens administrativas. */
export const ADMIN_MAX_PAGE_SIZE = 100;

/** O tamanho de pagina das tabelas do painel. */
export const ADMIN_PAGE_SIZE = 20;

/* ---- Pedidos ------------------------------------------------------------ */

export const ORDER_STATUSES = {
  PENDING_CONTACT: 'PENDING_CONTACT',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

/**
 * Os status que contam como venda fechada.
 *
 * Copia fiel de `SOLD_ORDER_STATUSES` no backend, e a fidelidade e o ponto:
 * o faturamento que o painel mostra precisa ser o mesmo numero que qualquer
 * relatorio do servidor daria. `PENDING_CONTACT` fica de fora porque metade
 * desses pedidos nunca vira conversa; `CANCELLED`, por motivo obvio.
 */
export const SOLD_ORDER_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
];

export const FULFILLMENT_MODES = { DELIVERY: 'DELIVERY', PICKUP: 'PICKUP' } as const;

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[keyof typeof FULFILLMENT_MODES];

export const PAYMENT_METHODS = { PIX: 'PIX', CARD: 'CARD' } as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/** A linha da tabela de pedidos. */
export interface AdminOrderSummary {
  id: string;
  code: string;
  status: OrderStatus;
  customerName: string;
  /** So digitos: e com ele que se monta o link da conversa. */
  phone: string;
  /** `(88) 99999-9999`, pronto pela API. */
  phoneLabel: string;
  mode: FulfillmentMode;
  /**
   * Como o pagamento foi combinado.
   *
   * No resumo, e nao so no detalhe: e a coluna que a dona le antes de abrir
   * a conversa. Um PIX pendente pede uma frase, um cartao em 6x pede outra.
   */
  payment: AdminOrderPayment;
  /** Unidades somadas, e nao o numero de linhas. */
  itemCount: number;
  totalCents: number;
  createdAt: string;
}

export interface AdminOrderItem {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  image: string;
  unitPriceCents: number;
  quantity: number;
  discountPercent: number;
  lineTotalCents: number;
}

export interface AdminOrderAddress {
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  reference: string;
}

export interface AdminOrderFulfillment {
  mode: FulfillmentMode;
  cityId: string | null;
  cityName: string;
  state: string;
  estimatedDays: number;
  /** `null` na retirada: nao ha endereco a preencher. */
  address: AdminOrderAddress | null;
}

export interface AdminOrderPayment {
  method: PaymentMethod;
  installments: number;
  hasInterest: boolean;
}

export interface AdminOrderTotals {
  subtotalCents: number;
  discountTotalCents: number;
  deliveryFeeCents: number;
  pixDiscountCents: number;
  totalCents: number;
}

export interface AdminOrderCustomer {
  name: string;
  phone: string;
  phoneLabel: string;
  email: string;
}

/** O pedido inteiro, como so o painel o ve. */
export interface AdminOrder {
  id: string;
  code: string;
  status: OrderStatus;
  items: AdminOrderItem[];
  customer: AdminOrderCustomer;
  fulfillment: AdminOrderFulfillment;
  payment: AdminOrderPayment;
  totals: AdminOrderTotals;
  /** A mensagem como foi montada e enviada ao WhatsApp. */
  whatsappMessage: string;
  /** Conversa interna da loja. Nunca sai para o cliente. */
  notes: string;
  /** Quando o cancelamento devolveu o estoque. `null` enquanto nao houve. */
  stockRestoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---- Produtos ----------------------------------------------------------- */

export interface AdminVariant {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  discountPercent: number;
  stock: number;
  image: string;
  isActive: boolean;
  allowBackorder: boolean;
  isAvailable: boolean;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  categoryIds: string[];
  images: string[];
  coverImage: string;
  variants: AdminVariant[];
  hasVariants: boolean;
  priceRangeCents: { min: number; max: number };
  discountPercent: number;
  inStock: boolean;
  /** Somado entre as variantes ativas. E o numero da coluna de estoque. */
  totalStock: number;
  isActive: boolean;
  isFeatured: boolean;
  isReadyToShip: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/* ---- Os limites do cadastro --------------------------------------------- */

/**
 * Os tetos que o servidor impoe, repetidos aqui.
 *
 * Nao e duplicacao por descuido: sao dois projetos separados, e o painel
 * precisa dos numeros **antes** de mandar, para dizer "so cabem mais duas
 * fotos" em vez de receber um 400 depois do upload. A fonte continua sendo
 * `products.constants.ts` e `schema-helpers.ts` do backend; qualquer
 * divergencia aparece como uma recusa que a tela nao previu.
 */
export const PRODUCT_LIMITS = {
  /** `MAX_IMAGES`. */
  images: 12,
  /** `MAX_VARIANTS`. */
  variants: 50,
  /** `MAX_STOCK`. */
  stock: 1_000_000,
  /** `MAX_CENTS`: R$ 999.999,99. */
  priceCents: 99_999_999,
  /** `MAX_SKU_LENGTH`. */
  sku: 40,
  /** `MAX_SLUG_LENGTH`. */
  slug: 120,
  name: 160,
  brand: 80,
  description: 5000,
  variantLabel: 60,
  tags: 20,
  tagLength: 40,
} as const;

/* ---- Categorias --------------------------------------------------------- */

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  /** Enderecos antigos que ainda redirecionam para este. */
  previousSlugs: string[];
  parentId: string | null;
  image: string;
  order: number;
  isActive: boolean;
  /** No pai, ja somados os das subcategorias. */
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Um nivel de aninhamento, e so um: subcategoria nao tem filhos. */
export interface AdminCategoryNode extends AdminCategory {
  children: AdminCategory[];
}

/* ---- O que o cadastro manda de volta ------------------------------------- */

/**
 * Uma variante no corpo do `POST` e do `PATCH`.
 *
 * `id` presente identifica variante que ja existe; ausente, o servidor cria.
 * O painel manda **o array inteiro** nas duas rotas e nao precisa saber o que
 * mudou — quem descobre e o diff do lado de la. Mandar um array parcial
 * apagaria as que ficaram de fora.
 */
export interface AdminVariantInput {
  id?: string;
  /** Sem ele, o servidor gera a partir do nome do produto e do label. */
  sku?: string;
  label?: string;
  priceCents: number;
  /** `null` tira o preco riscado da variante. */
  compareAtPriceCents?: number | null;
  stock?: number;
  image?: string;
  isActive?: boolean;
  allowBackorder?: boolean;
}

export interface CreateProductInput {
  name: string;
  /** Opcional: sem ele, o endereco sai do nome. */
  slug?: string;
  description?: string;
  brand?: string;
  categoryIds?: string[];
  /** `publicId`s do Cloudinary na ordem de exibicao. A primeira e a capa. */
  images?: string[];
  variants?: AdminVariantInput[];
  isActive?: boolean;
  isFeatured?: boolean;
  isReadyToShip?: boolean;
  tags?: string[];
}

/**
 * A edicao nao mexe no endereco.
 *
 * `slug` fica de fora porque o link ja foi para o WhatsApp de alguem, e
 * troca-lo exigiria guardar o anterior para redirecionar — uma operacao
 * separada, que a API ainda nao publica para produto.
 */
export type UpdateProductInput = Omit<CreateProductInput, 'slug'>;

/* ---- Envio de imagem ----------------------------------------------------- */

/** As tres larguras que a API devolve prontas depois do upload. */
export interface AdminImageUrls {
  thumb: string;
  card: string;
  detail: string;
}

/**
 * A autorizacao para mandar um arquivo direto ao Cloudinary.
 *
 * O arquivo **nao passa pelo backend**: ele vai do navegador para o
 * Cloudinary, e o servidor so assina o envio e confere o resultado depois. E
 * o que mantem uma funcao serverless fora do caminho de um JPEG de 4 MB.
 *
 * `params` viaja literal de proposito — sao exatamente os campos que foram
 * assinados, e o navegador os repete sem alterar nada, acrescentando apenas
 * `file` e `api_key`. Remontar essa lista aqui e o caminho mais curto para um
 * "Invalid Signature" que nao diz qual campo divergiu.
 */
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  /** Ja vem assinado: o navegador nao escolhe o identificador da foto. */
  publicId: string;
  uploadUrl: string;
  params: Record<string, string | number>;
  expiresAt: string;
  /** Conferido aqui antes de enviar, e de novo no `confirm`. */
  maxBytes: number;
  allowedFormats: readonly string[];
}

/** Uma imagem ja guardada e conferida, pronta para ser vinculada. */
export interface UploadedImage {
  publicId: string;
  folder: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  urls: AdminImageUrls;
}

/** As pastas em que o painel pode escrever. Iguais as de `image-public-id.ts`. */
export const UPLOAD_FOLDERS = {
  products: 'products',
  categories: 'categories',
  banners: 'banners',
} as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[keyof typeof UPLOAD_FOLDERS];

/* ---- O filtro de status da listagem -------------------------------------- */

/** `all` e o padrao: a dona quer ver o cadastro inteiro, e nao so o no ar. */
export const PRODUCT_STATUS_FILTERS = ['all', 'active', 'inactive'] as const;

export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

/* ---- O que o cadastro de categoria manda -------------------------------- */

export interface CreateCategoryInput {
  name: string;
  /** Opcional: sem ele, o endereco sai do nome. */
  slug?: string;
  /** `null` ou ausente cria uma categoria principal. */
  parentId?: string | null;
  image?: string;
  order?: number;
  isActive?: boolean;
}

/**
 * A edicao de categoria. Campo omitido fica como esta.
 *
 * `parentId` aceita `null` **de verdade**, e nao apenas a ausencia: omitir
 * deixa o pai como esta, e mandar `null` promove a subcategoria a categoria
 * principal. Sao duas intencoes diferentes, e o tipo precisa saber
 * distingui-las.
 *
 * O endereco (`slug`) esta aqui, ao contrario do produto: a categoria guarda
 * os enderecos antigos em `previousSlugs` e o servidor redireciona, entao
 * renomear a URL nao quebra o link que ja circulou.
 */
export type UpdateCategoryInput = Partial<CreateCategoryInput>;

/** Os limites que o servidor impoe ao cadastro de categoria. */
export const CATEGORY_LIMITS = {
  name: 80,
  /** `MAX_SLUG_LENGTH`. */
  slug: 120,
  /** `MAX_CATEGORY_ORDER`: o teto do campo de posicao, e da lista de reorder. */
  order: 9999,
} as const;

/**
 * O que o 409 de exclusao carrega.
 *
 * O servidor recusa apagar categoria que ainda tem subcategoria ou produto
 * ativo, e manda as contagens junto porque a pergunta seguinte e sempre
 * "quantos?". `canDeactivate` e a saida que ele oferece no lugar.
 */
export interface CategoryBlockedDetails {
  subcategoryCount: number;
  productCount: number;
  canDeactivate: boolean;
}

/* ---- Entrega ------------------------------------------------------------- */

/**
 * Uma cidade atendida, como o painel a ve.
 *
 * Nao ha CEP nem integracao com os Correios: a dona escolhe as cidades para
 * onde leva e quanto cobra em cada uma. E o modelo que corresponde a como a
 * entrega acontece de verdade — moto propria em Sobral, transportadora para
 * Fortaleza.
 */
export interface AdminDeliveryCity {
  id: string;
  name: string;
  /** Sigla de duas letras, gravada em maiuscula. */
  state: string;
  /** Zero e legitimo: e a cidade em que a loja nao cobra. */
  feeCents: number;
  /** Dias uteis. Zero e entrega no mesmo dia. */
  estimatedDays: number;
  /**
   * Frete gratis nesta cidade a partir deste valor.
   *
   * `null` **nao** e "sem frete gratis": e "sem regra propria", e a cidade
   * fica sob o minimo global da loja, que mora em Configuracoes. A distincao
   * importa na hora de salvar — mandar `null` apaga a regra da cidade, e
   * omitir o campo nao mexe nela.
   */
  minOrderForFreeCents: number | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeliveryCityInput {
  name: string;
  state: string;
  feeCents: number;
  estimatedDays?: number;
  minOrderForFreeCents?: number | null;
  isActive?: boolean;
  order?: number;
}

/** Edicao de cidade. Campo omitido fica como esta. */
export type UpdateDeliveryCityInput = Partial<CreateDeliveryCityInput>;

/** Os limites que o servidor impoe ao cadastro de cidade. */
export const DELIVERY_LIMITS = {
  name: 120,
  /** `MAX_ESTIMATED_DAYS`: tres meses ja e prazo de encomenda. */
  estimatedDays: 90,
  /** `MAX_CENTS`. */
  feeCents: 99_999_999,
  /** `MAX_DELIVERY_CITY_ORDER`. */
  order: 9999,
} as const;

/* ---- Pagamento ----------------------------------------------------------- */

/**
 * As regras de pagamento, como so o painel as ve.
 *
 * A diferenca para `PublicPaymentSettings` e uma linha: a chave PIX inteira.
 * Ela nao sai na rota publica — e o endereco para onde vai o dinheiro da
 * loja, e so faz sentido no fim do pedido, junto do valor e do titular. Aqui
 * ela precisa aparecer, porque e aqui que se confere se esta certa.
 *
 * Nenhum pagamento e processado pelo sistema. Estes campos descrevem o que a
 * loja aceita e alimentam a conta das parcelas; a cobranca acontece por fora.
 */
export interface AdminPaymentSettings {
  acceptsPix: boolean;
  /** Vazia e o estado em que a loja nasce — e o PIX nao pode ser oferecido. */
  pixKey: string;
  pixKeyType: PixKeyType;
  /** Incide so sobre o subtotal de produtos, nunca sobre a entrega. */
  pixDiscountPercent: number;
  acceptsCard: boolean;
  maxInstallments: number;
  /** Ate aqui, divisao simples. Acima, tabela price. */
  interestFreeUpTo: number;
  /** O unico percentual fracionario do projeto: 1,99 e o valor da maquininha. */
  monthlyInterestPercent: number;
  /** Opcao cuja parcela cai abaixo disto nao e oferecida. */
  minInstallmentCents: number;
  updatedAt: string;
}

/**
 * Edicao das regras. Campo omitido fica como esta.
 *
 * `pixKey` e `pixKeyType` viajam juntos quando qualquer um dos dois muda: o
 * servidor confere o par, e trocar so o tipo deixaria gravada uma chave que o
 * cliente nao consegue usar.
 */
export type UpdatePaymentSettingsInput = Partial<Omit<AdminPaymentSettings, 'updatedAt'>>;

/** Os tetos que o servidor impoe as regras de pagamento. */
export const PAYMENT_LIMITS = {
  /** `MAX_INSTALLMENTS`: cartao nenhum aceita mais. */
  installments: 24,
  /** `MAX_MONTHLY_INTEREST_PERCENT`. */
  monthlyInterestPercent: 20,
  /**
   * `MAX_PIX_DISCOUNT_PERCENT`. Metade do pedido ja e absurdo, e o teto existe
   * para o zero a mais nao virar promocao: 50 no lugar de 5 e erro de dedo.
   */
  pixDiscountPercent: 50,
  /** `MAX_PIX_KEY_LENGTH`. */
  pixKeyLength: 140,
  /** `MAX_CENTS`. */
  minInstallmentCents: 99_999_999,
} as const;
