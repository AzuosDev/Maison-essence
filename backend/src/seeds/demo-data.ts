import { INSTITUTIONAL_PAGE_SLUGS } from '../common/enums/institutional-page.js';
import type { InstitutionalPageSlug } from '../common/enums/institutional-page.js';
import { PIX_KEY_TYPES } from '../common/enums/payment-method.js';
import type { PixKeyType } from '../common/enums/payment-method.js';

/**
 * Conteudo do `npm run seed:demo`: uma loja pequena e inteira, para o frontend
 * ter o que desenhar antes de existir cadastro de verdade.
 *
 * So dados, sem Mongoose: quem grava e o `DemoSeedService`. Cada registro tem
 * a sua chave natural (o slug, o par cidade+estado), porque e por ela que o
 * seed decide entre criar e atualizar — rodar duas vezes nao pode dobrar o
 * catalogo.
 *
 * Nenhum registro traz imagem. O schema guarda `publicId` do Cloudinary, nao
 * URL, e publicId inventado nao resolve em conta nenhuma: renderizaria imagem
 * quebrada no lugar do placeholder que o frontend ja sabe mostrar.
 */

export interface DemoCategory {
  name: string;
  slug: string;
  order: number;
}

export interface DemoVariant {
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
}

export interface DemoProduct {
  name: string;
  slug: string;
  description: string;
  brand: string;
  categorySlugs: readonly string[];
  isFeatured: boolean;
  isReadyToShip: boolean;
  tags: readonly string[];
  variants: readonly DemoVariant[];
}

export interface DemoCity {
  name: string;
  state: string;
  feeCents: number;
  estimatedDays: number;
  minOrderForFreeCents: number | null;
  order: number;
}

export interface DemoInstitutionalPage {
  slug: InstitutionalPageSlug;
  title: string;
  content: string;
}

export const DEMO_CATEGORIES: readonly DemoCategory[] = [
  { name: 'Perfumes Árabes', slug: 'perfumes-arabes', order: 1 },
  { name: 'Perfumes Importados', slug: 'perfumes-importados', order: 2 },
  { name: 'Casa e Aromas', slug: 'casa-e-aromas', order: 3 },
];

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  {
    name: 'Asad',
    slug: 'asad',
    description:
      'Amadeirado intenso, com abertura cítrica e fundo de baunilha e âmbar. O árabe mais pedido da loja.',
    brand: 'Lattafa',
    categorySlugs: ['perfumes-arabes'],
    isFeatured: true,
    isReadyToShip: true,
    tags: ['amadeirado', 'masculino', 'noite'],
    variants: [
      {
        sku: 'ASAD-100',
        label: '100 ml',
        priceCents: 24_990,
        compareAtPriceCents: 29_990,
        stock: 12,
      },
      {
        sku: 'ASAD-10',
        label: 'Decant 10 ml',
        priceCents: 4990,
        compareAtPriceCents: null,
        stock: 30,
      },
    ],
  },
  {
    name: 'Khamrah',
    slug: 'khamrah',
    description:
      'Gourmand especiado: canela, rum e tonka. Fixação longa e mais bonito no tempo frio.',
    brand: 'Lattafa',
    categorySlugs: ['perfumes-arabes'],
    isFeatured: true,
    isReadyToShip: false,
    tags: ['gourmand', 'unissex', 'inverno'],
    variants: [
      {
        sku: 'KHAM-100',
        label: '100 ml',
        priceCents: 27_990,
        compareAtPriceCents: null,
        stock: 6,
      },
    ],
  },
  {
    name: 'Yara Tous',
    slug: 'yara-tous',
    description: 'Floral doce, com coco e baunilha. Marcante e feminino, aguenta o dia inteiro.',
    brand: 'Lattafa',
    categorySlugs: ['perfumes-arabes'],
    isFeatured: false,
    isReadyToShip: true,
    tags: ['floral', 'feminino'],
    variants: [
      {
        sku: 'YARA-50',
        label: '50 ml',
        priceCents: 19_990,
        compareAtPriceCents: 22_990,
        stock: 9,
      },
    ],
  },
  {
    name: 'La Vie Est Belle',
    slug: 'la-vie-est-belle',
    description: 'Iris, patchouli e praline. Classico francês, original lacrado e com caixa.',
    brand: 'Lancome',
    categorySlugs: ['perfumes-importados'],
    isFeatured: true,
    isReadyToShip: false,
    tags: ['floral', 'feminino', 'presente'],
    variants: [
      {
        sku: 'LVEB-50',
        label: '50 ml',
        priceCents: 49_900,
        compareAtPriceCents: null,
        stock: 3,
      },
      {
        sku: 'LVEB-100',
        label: '100 ml',
        priceCents: 69_900,
        compareAtPriceCents: 74_900,
        stock: 2,
      },
    ],
  },
  {
    name: 'Good Girl',
    slug: 'good-girl',
    description: 'Tuberosa e cacau em contraste. O frasco de salto alto que todo mundo reconhece.',
    brand: 'Carolina Herrera',
    categorySlugs: ['perfumes-importados'],
    isFeatured: false,
    isReadyToShip: false,
    tags: ['oriental', 'feminino', 'noite'],
    variants: [
      {
        sku: 'GG-80',
        label: '80 ml',
        priceCents: 64_900,
        compareAtPriceCents: null,
        stock: 4,
      },
    ],
  },
  {
    name: 'Vela Aromatica Lavanda',
    slug: 'vela-aromatica-lavanda',
    description:
      'Cera vegetal e pavio de algodão, feita a mão. Cerca de 40 horas de queima no pote grande.',
    brand: 'Maison Essence',
    categorySlugs: ['casa-e-aromas'],
    isFeatured: false,
    isReadyToShip: true,
    tags: ['casa', 'relaxante', 'artesanal'],
    variants: [
      {
        sku: 'VELA-LAV-180',
        label: '180 g',
        priceCents: 6990,
        compareAtPriceCents: null,
        stock: 20,
      },
      {
        sku: 'VELA-LAV-360',
        label: '360 g',
        priceCents: 11_990,
        compareAtPriceCents: 13_990,
        stock: 10,
      },
    ],
  },
];

export const DEMO_CITIES: readonly DemoCity[] = [
  {
    name: 'Sobral',
    state: 'CE',
    feeCents: 1000,
    estimatedDays: 1,
    // Regra propria, mais generosa que a global: e a entrega na cidade da loja.
    minOrderForFreeCents: 15_000,
    order: 1,
  },
  {
    name: 'Fortaleza',
    state: 'CE',
    feeCents: 2500,
    estimatedDays: 3,
    // Sem regra propria: cai na regra global de `StoreSettings`.
    minOrderForFreeCents: null,
    order: 2,
  },
];

export const DEMO_INSTITUTIONAL_PAGES: readonly DemoInstitutionalPage[] = [
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT,
    title: 'Quem somos',
    content: [
      '## Maison Essence',
      '',
      'Perfumaria em Sobral, no Ceará. Trabalhamos com árabes, importados',
      'originais e velas feitas a mão.',
      '',
    ].join('\n'),
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY,
    title: 'Como comprar',
    content: [
      '1. Escolha os produtos e adicione ao carrinho.',
      '2. Informe seus dados e a cidade de entrega.',
      '3. O pedido segue para o nosso WhatsApp, onde combinamos o pagamento.',
      '',
    ].join('\n'),
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.RETURNS,
    title: 'Trocas e devoluções',
    content: [
      'Você tem 7 dias corridos a partir do recebimento para desistir da',
      'compra, conforme o Código de Defesa do Consumidor. O produto precisa',
      'voltar lacrado.',
      '',
    ].join('\n'),
  },
];

export const DEMO_STORE_SETTINGS = {
  storeName: 'Maison Essence',
  // Numero de exemplo: troque no painel antes de mostrar a loja para alguem.
  whatsappNumber: '5588999999999',
  announcementText: 'Frete grátis acima de R$ 250 para todo o Ceará',
  contactEmail: 'contato@maisonessence.com.br',
  businessHours: 'Seg a Sex, 9h as 18h. Sab, 9h as 13h',
  pickupEnabled: true,
  pickupAddress: {
    street: 'Rua Coronel Jose Silvestre',
    number: '120',
    complement: 'Sala 2',
    district: 'Centro',
    city: 'Sobral',
    state: 'CE',
    zipCode: '62010-000',
    reference: 'Em frente a praça da Se',
  },
  pickupInstructions: 'Avise no WhatsApp antes de vir: separamos o pedido em até duas horas.',
  socialLinks: {
    instagram: 'https://instagram.com/maisonessence',
    tiktok: '',
  },
  freeShippingMinCents: 25_000,
} as const;

export const DEMO_PAYMENT_SETTINGS = {
  acceptsPix: true,
  pixKey: 'contato@maisonessence.com.br',
  pixKeyType: PIX_KEY_TYPES.EMAIL as PixKeyType,
  pixDiscountPercent: 5,
  acceptsCard: true,
  maxInstallments: 12,
  interestFreeUpTo: 3,
  monthlyInterestPercent: 1.99,
  minInstallmentCents: 2000,
} as const;
