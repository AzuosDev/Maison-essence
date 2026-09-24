/*
 * Entrada descartavel de desenvolvimento.
 *
 * Nao entra no build: existe so para abrir a loja sem backend e sem banco,
 * com dados de exemplo, enquanto o visual e revisado. Apague este arquivo,
 * o `dev-preview.html` e o `.env.preview` quando a revisao terminar.
 */

/* eslint-disable */

interface Variant {
  id: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  discountPercent: number;
  stock: number;
  isAvailable: boolean;
  onDemand: boolean;
  image: string;
}

const PHOTOS = [
  'samples/ecommerce/accessories-bag',
  'samples/ecommerce/leather-bag-gray',
  'samples/ecommerce/shoes',
  'samples/cup-on-a-table',
  'samples/ecommerce/car-interior-design',
  'samples/food/spices',
  'samples/balloons',
  'samples/dessert-on-a-plate',
];

interface Seed {
  name: string;
  brand: string;
  price: number;
  compareAt?: number;
  ready?: boolean;
  out?: boolean;
  variants?: string[];
  qty?: { minQty: number; percentOff: number };
}

const SEEDS: Seed[] = [
  { name: 'Oud Royale Intense', brand: 'Maison Essence', price: 38900, compareAt: 45900, ready: true, variants: ['50 ml', '100 ml'] },
  { name: 'Baunilha Absoluta', brand: 'Maison Essence', price: 27900, ready: true },
  { name: 'Âmbar & Sandalo', brand: 'Lattafa', price: 19900, compareAt: 24900, qty: { minQty: 3, percentOff: 12 } },
  { name: 'Vela Fig de Provence', brand: 'Maison Essence', price: 14900, ready: true },
  { name: 'Rose Damascena Eau de Parfum', brand: 'Armaf', price: 32900, variants: ['30 ml', '75 ml'] },
  { name: 'Musk Blanc', brand: 'Swiss Arabian', price: 21900, out: true },
  { name: 'Patchouli Noir', brand: 'Maison Essence', price: 35900, compareAt: 41900, ready: true },
  { name: 'Difusor Cedro & Bergamota', brand: 'Maison Essence', price: 11900 },
  { name: 'Tobacco Vanille Extrait', brand: 'Maison Essence', price: 49900, ready: true, variants: ['50 ml', '100 ml'] },
  { name: 'Jasmim Nocturne', brand: 'Lattafa', price: 23900 },
  { name: 'Couro & Especiarias', brand: 'Armaf', price: 28900, compareAt: 33900 },
  { name: 'Vela Brisa de Linho', brand: 'Maison Essence', price: 12900, ready: true },
];

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeProduct(seed: Seed, index: number) {
  const slug = slugify(seed.name);
  const images = [PHOTOS[index % PHOTOS.length]!, PHOTOS[(index + 3) % PHOTOS.length]!];
  const labels = seed.variants ?? ['Único'];

  const variants: Variant[] = labels.map((label, position) => ({
    id: `${slug}-v${position}`,
    label,
    priceCents: seed.price + position * 9000,
    compareAtPriceCents: seed.compareAt === undefined ? null : seed.compareAt + position * 9000,
    discountPercent:
      seed.compareAt === undefined
        ? 0
        : Math.round((1 - seed.price / seed.compareAt) * 100),
    stock: seed.out ? 0 : 8,
    isAvailable: !seed.out,
    onDemand: false,
    image: images[0]!,
  }));

  const prices = variants.map((variant) => variant.priceCents);

  return {
    id: slug,
    name: seed.name,
    slug,
    brand: seed.brand,
    images,
    coverImage: images[0]!,
    variants,
    hasVariants: labels.length > 1,
    priceRangeCents: { min: Math.min(...prices), max: Math.max(...prices) },
    discountPercent:
      seed.compareAt === undefined ? 0 : Math.round((1 - seed.price / seed.compareAt) * 100),
    inStock: !seed.out,
    isFeatured: index < 4,
    isReadyToShip: seed.ready === true,
    tags: [],
    quantityDiscount: seed.qty ?? null,
  };
}

const PRODUCTS = SEEDS.map(makeProduct);

const CATEGORIES = [
  { name: 'Perfumes Masculinos', photo: PHOTOS[0]!, count: 24 },
  { name: 'Perfumes Femininos', photo: PHOTOS[1]!, count: 31 },
  { name: 'Árabes', photo: PHOTOS[4]!, count: 18 },
  { name: 'Velas Aromaticas', photo: PHOTOS[3]!, count: 12 },
  { name: 'Difusores', photo: PHOTOS[5]!, count: 9 },
  { name: 'Kits e Presentes', photo: PHOTOS[6]!, count: 7 },
].map((entry, index) => ({
  id: `cat-${index}`,
  name: entry.name,
  slug: slugify(entry.name),
  image: entry.photo,
  productCount: entry.count,
  children: [],
}));

const PAGES = [
  { slug: 'quem-somos', title: 'Quem somos' },
  { slug: 'como-comprar', title: 'Como comprar' },
  { slug: 'trocas-e-devolucoes', title: 'Trocas e devoluções' },
  { slug: 'perguntas-frequentes', title: 'Perguntas frequentes' },
  { slug: 'politica-de-privacidade', title: 'Política de privacidade' },
];

const SETTINGS = {
  storeName: 'Maison Essence',
  whatsappNumber: '5588999998888',
  whatsappLink: 'https://wa.me/5588999998888',
  announcementText: 'Frete fixo para o Cariri · Retirada em Juazeiro do Norte · Parcelamos no cartão',
  contactEmail: 'contato@maisonessence.com.br',
  businessHours: 'Segunda a sabado, das 9h as 18h',
  socialLinks: {
    instagram: 'https://instagram.com/maisonessence',
    tiktok: 'https://tiktok.com/@maisonessence',
  },
  pickupEnabled: true,
  pickupAddress: {
    street: 'Rua São Pedro',
    number: '120',
    complement: '',
    district: 'Centro',
    city: 'Juazeiro do Norte',
    state: 'CE',
    zipCode: '63010-000',
    reference: '',
  },
  pickupInstructions: 'Combine o horário pelo WhatsApp.',
  freeShippingMinCents: 29900,
  banners: [
    {
      id: 'b1',
      imageDesktop: PHOTOS[4]!,
      imageMobile: PHOTOS[4]!,
      title: 'A coleção de inverno chegou',
      subtitle: 'Âmbares, madeiras e baunilhas selecionados peca a peca.',
      buttonLabel: 'Ver a coleção',
      link: '/produtos',
    },
    {
      id: 'b2',
      imageDesktop: PHOTOS[1]!,
      imageMobile: PHOTOS[1]!,
      title: 'Pronta entrega no Cariri',
      subtitle: 'Retire hoje em Juazeiro do Norte ou receba primeiro.',
      buttonLabel: 'Ver pronta entrega',
      link: '/pronta-entrega',
    },
  ],
};

const PAYMENTS = {
  pix: { keyType: 'cnpj', hasKey: true, discountPercent: 5 },
  card: {
    maxInstallments: 10,
    interestFreeUpTo: 6,
    monthlyInterestPercent: 2.5,
    minInstallmentCents: 3000,
  },
};

const SHELVES: Record<string, unknown[]> = {
  featured: PRODUCTS.slice(0, 8),
  'ready-to-ship': PRODUCTS.filter((product) => product.isReadyToShip),
  'best-sellers': PRODUCTS.slice(4, 12),
};

function detail(slug: string) {
  const product = PRODUCTS.find((item) => item.slug === slug) ?? PRODUCTS[0]!;

  return {
    ...product,
    description:
      'Notas de topo de bergamota e cardamomo, coração de rosa damascena e fundo de oud, âmbar e baunilha. Fixação de 8 a 12 horas na pele, com sillage moderado.\n\nFrasco lacrado, original, conferido antes de sair da loja.',
    categories: [{ id: CATEGORIES[0]!.id, name: CATEGORIES[0]!.name, slug: CATEGORIES[0]!.slug }],
    quantityDiscounts: [
      { minQty: 2, percentOff: 8 },
      { minQty: 3, percentOff: 12 },
    ],
    related: PRODUCTS.filter((item) => item.slug !== product.slug).slice(0, 8),
  };
}

function route(path: string, query: URLSearchParams): unknown {
  if (path === '/settings') return SETTINGS;
  if (path === '/payment-settings') return PAYMENTS;
  if (path === '/pages') return PAGES;
  if (path.startsWith('/pages/')) {
    const slug = path.slice('/pages/'.length);
    const page = PAGES.find((item) => item.slug === slug) ?? PAGES[0]!;

    return { ...page, content: '## Sobre\n\nTexto de exemplo do preview.' };
  }
  if (path === '/categories') return CATEGORIES;
  if (path.startsWith('/categories/')) {
    const slug = path.slice('/categories/'.length);

    return CATEGORIES.find((item) => item.slug === slug) ?? CATEGORIES[0]!;
  }
  if (path === '/products') {
    const term = (query.get('q') ?? '').toLowerCase();
    const items = term
      ? PRODUCTS.filter((product) => product.name.toLowerCase().includes(term))
      : PRODUCTS;

    return { items, page: 1, totalPages: 1, totalItems: items.length, hasMore: false };
  }
  if (path.startsWith('/products/')) {
    const name = path.slice('/products/'.length);

    return SHELVES[name] ?? detail(name);
  }

  return null;
}

const original = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (!href.includes('/api/v1')) {
    return original(input as RequestInfo, init);
  }

  const url = new URL(href);
  const path = url.pathname.replace('/api/v1', '');
  const body = route(decodeURIComponent(path), url.searchParams);

  await new Promise((resolve) => {
    setTimeout(resolve, 120);
  });

  if (body === null) {
    return new Response(
      JSON.stringify({ statusCode: 404, message: 'Não encontrado', error: 'Not Found', timestamp: '', path }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

// `dev-preview.html#/produtos` abre a rota sem depender do fallback do Vite.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1));
}

void import('./main');
