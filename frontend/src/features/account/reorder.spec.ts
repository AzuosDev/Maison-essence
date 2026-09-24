import { expect, test } from 'vitest';
import type { CartQuote, QuoteLine } from '@/features/cart';
import type { OrderItemView } from '@/features/checkout';
import { isEmptyPlan, planReorder, reorderItems } from './reorder';

/**
 * Pedir novamente.
 *
 * O criterio de aceite diz duas coisas: o carrinho e montado corretamente e
 * os itens inativos sao ignorados. A segunda metade e a que tem armadilha,
 * porque "inativo" chega do servidor de tres formas diferentes — produto
 * fora do catalogo, opcao desativada e estoque insuficiente — e a terceira
 * **nao** e um item que saiu de linha.
 */

function item(over: Partial<OrderItemView> = {}): OrderItemView {
  return {
    productId: 'p1',
    variantId: 'v1',
    productName: 'Asad Lattafa',
    variantLabel: '100ml',
    image: 'maison/asad',
    unitPriceCents: 18990,
    quantity: 2,
    discountPercent: 0,
    lineTotalCents: 37980,
    ...over,
  };
}

function line(over: Partial<QuoteLine> = {}): QuoteLine {
  return {
    productId: 'p1',
    variantId: 'v1',
    productName: 'Asad Lattafa',
    productSlug: 'asad-lattafa',
    variantLabel: '100ml',
    image: 'maison/asad',
    quantity: 2,
    unitPriceCents: 18990,
    availableStock: 10,
    allowBackorder: false,
    discountPercent: 0,
    discountCents: 0,
    lineTotalCents: 37980,
    unavailable: false,
    unavailableReason: '',
    ...over,
  };
}

function quote(items: QuoteLine[]): CartQuote {
  return {
    items,
    fulfillment: {
      mode: 'pickup',
      cityId: null,
      cityName: '',
      state: '',
      estimatedDays: 0,
      requiresAddress: false,
      feeCents: 0,
      isFree: true,
      freeReason: '',
      missingForFreeCents: null,
    },
    payment: { method: 'pix', installments: 1, selected: null },
    subtotalCents: 0,
    discountTotalCents: 0,
    deliveryFeeCents: 0,
    pixDiscountCents: 0,
    totalCents: 0,
    installmentOptions: [],
    warnings: [],
  };
}

test('as linhas do pedido viram o corpo da cotação, sem preço', () => {
  // Preco nenhum atravessa: quem diz quanto custa hoje e o servidor, e um
  // valor de meses atras na sacola seria um numero que ninguem vai cobrar.
  expect(reorderItems([item(), item({ productId: 'p2', quantity: 1 })])).toEqual([
    { productId: 'p1', variantId: 'v1', quantity: 2 },
    { productId: 'p2', variantId: 'v1', quantity: 1 },
  ]);
});

test('o item que continua a venda entra com a quantidade do pedido', () => {
  const plan = planReorder([item()], quote([line()]));

  expect(plan.added).toHaveLength(1);
  expect(plan.added[0]?.line).toEqual({ productId: 'p1', variantId: 'v1', quantity: 2 });
  expect(plan.adjusted).toEqual([]);
  expect(plan.dropped).toEqual([]);
});

test('a dica vem da cotação, porque só ela tem o slug', () => {
  // O pedido guarda nome e foto, mas nao o endereco do produto. Sem o slug,
  // a gaveta da sacola desenharia o item sem link para a pagina dele.
  const plan = planReorder([item()], quote([line()]));

  expect(plan.added[0]?.hint).toEqual({
    name: 'Asad Lattafa',
    slug: 'asad-lattafa',
    variantLabel: '100ml',
    image: 'maison/asad',
  });
});

test('o produto que saiu do catalogo não entra, e o aviso diz qual foi', () => {
  const plan = planReorder(
    [item()],
    quote([
      line({
        productName: '',
        productSlug: '',
        availableStock: 0,
        unavailable: true,
        unavailableReason: 'Este produto saiu do catalogo.',
      }),
    ]),
  );

  expect(plan.added).toEqual([]);

  // O nome sai do **pedido**, e nao da cotacao: produto excluido volta com
  // `productName` vazio, e "Um item saiu do catalogo" mandaria a cliente
  // abrir o pedido para descobrir qual.
  expect(plan.dropped).toEqual([
    { name: 'Asad Lattafa', reason: 'Este produto saiu do catalogo.' },
  ]);
});

test('o motivo e a frase do servidor, sem reescrita', () => {
  const plan = planReorder(
    [item()],
    quote([
      line({
        availableStock: 0,
        unavailable: true,
        unavailableReason: 'Essa opção não esta mais a venda.',
      }),
    ]),
  );

  expect(plan.dropped[0]?.reason).toBe('Essa opção não esta mais a venda.');
});

test('estoque menor que o pedido entra com o que resta, e não e descartado', () => {
  // O caso que separa este planejador de um `filter`: o item **nao** saiu de
  // linha. Joga-lo fora obrigaria a cliente a procurar o perfume no catalogo
  // e adicionar a mao o que ja estava ali.
  const plan = planReorder(
    [item({ quantity: 3 })],
    quote([
      line({
        quantity: 3,
        availableStock: 2,
        unavailable: true,
        unavailableReason: 'Restam apenas 2 unidades em estoque.',
      }),
    ]),
  );

  expect(plan.dropped).toEqual([]);
  expect(plan.adjusted).toHaveLength(1);
  expect(plan.adjusted[0]?.line.quantity).toBe(2);

  // E o quanto foi pedido continua a mao, para a tela poder dizer "2 de 3".
  expect(plan.adjusted[0]?.requested).toBe(3);
});

test('o que decide entre acabou e diminuiu e o estoque, não o texto', () => {
  // Produto fora do catalogo e opcao desativada chegam sempre com estoque
  // zero — nem variante existe para consultar. Ler a frase para decidir
  // amarraria o planejador a redacao do backend.
  const semEstoque = planReorder(
    [item()],
    quote([line({ availableStock: 0, unavailable: true, unavailableReason: 'Esgotado.' })]),
  );

  expect(semEstoque.dropped).toHaveLength(1);
  expect(semEstoque.adjusted).toEqual([]);
});

test('pedido misto separa os três montes de uma vez', () => {
  const plan = planReorder(
    [
      item({ productId: 'p1', productName: 'Asad' }),
      item({ productId: 'p2', productName: 'Yara', quantity: 4 }),
      item({ productId: 'p3', productName: 'Khamrah' }),
    ],
    quote([
      line({ productId: 'p1', productName: 'Asad' }),
      line({
        productId: 'p2',
        productName: 'Yara',
        quantity: 4,
        availableStock: 1,
        unavailable: true,
        unavailableReason: 'Restam apenas 1 unidade em estoque.',
      }),
      line({
        productId: 'p3',
        productName: 'Khamrah',
        availableStock: 0,
        unavailable: true,
        unavailableReason: 'Este produto saiu do catalogo.',
      }),
    ]),
  );

  expect(plan.added.map((entry) => entry.hint.name)).toEqual(['Asad']);
  expect(plan.adjusted.map((entry) => entry.hint.name)).toEqual(['Yara']);
  expect(plan.dropped.map((entry) => entry.name)).toEqual(['Khamrah']);
  expect(isEmptyPlan(plan)).toBe(false);
});

test('pedido inteiro fora do catalogo produz um plano vazio', () => {
  // A tela precisa saber disto para nao abrir a gaveta da sacola: abrir
  // mostraria a sacola como ela ja estava, e leria como "nao aconteceu
  // nada" — quando o que aconteceu foi o pedido inteiro ter saido de linha.
  const plan = planReorder(
    [item()],
    quote([line({ availableStock: 0, unavailable: true, unavailableReason: 'Esgotado.' })]),
  );

  expect(isEmptyPlan(plan)).toBe(true);
});

test('linha pedida que não volta na cotação fica de fora com uma frase honesta', () => {
  // Nao deveria acontecer — o servidor devolve todas as linhas, inclusive as
  // indisponiveis. Se acontecer, o item nao entra no escuro.
  const plan = planReorder([item()], quote([]));

  expect(plan.added).toEqual([]);
  expect(plan.dropped[0]?.name).toBe('Asad Lattafa');
});
