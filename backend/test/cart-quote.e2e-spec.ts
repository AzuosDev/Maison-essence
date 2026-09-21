import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { QUOTE_RATE_LIMIT } from '../src/modules/cart/cart.constants.js';
import {
  DeliveryCity,
  FULFILLMENT_MODES,
  Order,
  PAYMENT_METHODS,
  PaymentSettings,
  Product,
  QuantityDiscount,
  RateLimitHit,
  StoreSettings,
} from '../src/schemas.js';

const API = '/api/v1';
const QUOTE = `${API}/cart/quote`;

/** Precos da loja de teste, em centavos. */
const PRICE_100ML = 19_990;
const PRICE_50ML = 9_990;
const CITY_FEE = 1_500;
const PIX_PERCENT = 5;

interface Seeded {
  productId: string;
  bigId: string;
  /** Variante esgotada: estoque zero e sem venda sob encomenda. */
  emptyId: string;
  cityId: string;
  categoryId: Types.ObjectId;
}

describe('cotacao do carrinho (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let products: Model<Product>;
  let cities: Model<DeliveryCity>;
  let payments: Model<PaymentSettings>;
  let store: Model<StoreSettings>;
  let discounts: Model<QuantityDiscount>;
  let orders: Model<Order>;
  let hits: Model<RateLimitHit>;
  let seeded: Seeded;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    products = app.get<Model<Product>>(getModelToken(Product.name));
    cities = app.get<Model<DeliveryCity>>(getModelToken(DeliveryCity.name));
    payments = app.get<Model<PaymentSettings>>(getModelToken(PaymentSettings.name));
    store = app.get<Model<StoreSettings>>(getModelToken(StoreSettings.name));
    discounts = app.get<Model<QuantityDiscount>>(getModelToken(QuantityDiscount.name));
    orders = app.get<Model<Order>>(getModelToken(Order.name));
    hits = app.get<Model<RateLimitHit>>(getModelToken(RateLimitHit.name));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    seeded = await seedStore();
  });

  afterEach(async () => {
    await Promise.all([
      products.deleteMany({}),
      cities.deleteMany({}),
      payments.deleteMany({}),
      store.deleteMany({}),
      discounts.deleteMany({}),
      orders.deleteMany({}),
      // O limite e por IP e todos os testes chegam do mesmo: sem limpar, um
      // teste gastaria o orcamento do seguinte.
      hits.deleteMany({}),
    ]);
  });

  /** Uma loja pequena: um perfume com duas variantes e uma cidade atendida. */
  async function seedStore(): Promise<Seeded> {
    const categoryId = new Types.ObjectId();
    const product = await products.create({
      name: 'Asad',
      slug: 'asad',
      brand: 'Lattafa',
      categoryIds: [categoryId],
      images: ['asad-capa'],
      variants: [
        { sku: 'ASAD-100', label: '100 ml', priceCents: PRICE_100ML, stock: 10 },
        { sku: 'ASAD-50', label: '50 ml', priceCents: PRICE_50ML, stock: 0 },
      ],
      isActive: true,
    });
    const city = await cities.create({
      name: 'Sobral',
      state: 'CE',
      feeCents: CITY_FEE,
      estimatedDays: 2,
    });

    await payments.create({
      acceptsPix: true,
      pixDiscountPercent: PIX_PERCENT,
      acceptsCard: true,
      maxInstallments: 12,
      interestFreeUpTo: 3,
      monthlyInterestPercent: 0,
      minInstallmentCents: 2_000,
    });
    await store.create({ freeShippingMinCents: null });

    return {
      productId: product._id.toHexString(),
      bigId: product.variants[0]!.id as string,
      emptyId: product.variants[1]!.id as string,
      cityId: city._id.toHexString(),
      categoryId,
    };
  }

  /** O corpo padrao: uma unidade da variante cheia, entrega em Sobral, PIX. */
  function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 1 }],
      fulfillment: { mode: FULFILLMENT_MODES.DELIVERY, cityId: seeded.cityId },
      payment: { method: PAYMENT_METHODS.PIX, installments: 1 },
      ...overrides,
    };
  }

  function quote(payload: Record<string, unknown>): request.Test {
    return request(server).post(QUOTE).send(payload);
  }

  describe('preco', () => {
    it('cota pelo preco do catalogo', async () => {
      const { body: quoted } = await quote(body()).expect(200);

      expect(quoted.items[0].unitPriceCents).toBe(PRICE_100ML);
      expect(quoted.subtotalCents).toBe(PRICE_100ML);
      expect(quoted.deliveryFeeCents).toBe(CITY_FEE);
      // 5% de R$ 199,90 sao R$ 9,995, arredondados a favor de quem paga.
      expect(quoted.pixDiscountCents).toBe(1_000);
      expect(quoted.totalCents).toBe(PRICE_100ML - 1_000 + CITY_FEE);
    });

    it('ignora o preco adulterado que vem no corpo', async () => {
      const honest = await quote(body()).expect(200);
      const tampered = await quote(
        body({
          items: [
            {
              productId: seeded.productId,
              variantId: seeded.bigId,
              quantity: 1,
              // O que um cliente mal-intencionado mandaria, com os nomes que
              // a propria resposta usa.
              unitPriceCents: 1,
              lineTotalCents: 1,
              discountPercent: 90,
            },
          ],
          subtotalCents: 1,
          totalCents: 1,
          deliveryFeeCents: 0,
        }),
      ).expect(200);

      expect(tampered.body.items[0].unitPriceCents).toBe(PRICE_100ML);
      expect(tampered.body.items[0].discountPercent).toBe(0);
      expect(tampered.body.totalCents).toBe(honest.body.totalCents);
    });

    it('nao grava nada', async () => {
      await quote(body()).expect(200);

      expect(await orders.countDocuments()).toBe(0);
      expect(await products.countDocuments()).toBe(1);
      // O estoque continua inteiro: cotar nao reserva.
      const product = await products.findById(seeded.productId).exec();

      expect(product?.variants[0]?.stock).toBe(10);
    });
  });

  describe('itens', () => {
    it('marca o item sem estoque e o deixa fora do total', async () => {
      const { body: quoted } = await quote(
        body({
          items: [
            { productId: seeded.productId, variantId: seeded.bigId, quantity: 1 },
            { productId: seeded.productId, variantId: seeded.emptyId, quantity: 1 },
          ],
        }),
      ).expect(200);

      const [cheio, esgotado] = quoted.items;

      expect(cheio.unavailable).toBe(false);
      expect(esgotado.unavailable).toBe(true);
      expect(esgotado.unavailableReason).not.toBe('');
      expect(esgotado.lineTotalCents).toBe(0);
      // O total e o do item que sobrou, sem nenhum centavo do esgotado.
      expect(quoted.subtotalCents).toBe(PRICE_100ML);
      expect(quoted.warnings.length).toBeGreaterThan(0);
    });

    it('marca o item de produto desativado sem derrubar a cotacao', async () => {
      await products.updateOne({ _id: seeded.productId }, { $set: { isActive: false } }).exec();

      const { body: quoted } = await quote(body()).expect(200);

      expect(quoted.items[0].unavailable).toBe(true);
      expect(quoted.subtotalCents).toBe(0);
    });

    it('aplica o desconto por quantidade cadastrado para o produto', async () => {
      await discounts.create({ productId: seeded.productId, minQty: 3, percentOff: 10 });

      const { body: quoted } = await quote(
        body({
          items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 3 }],
        }),
      ).expect(200);

      expect(quoted.items[0].discountPercent).toBe(10);
      expect(quoted.discountTotalCents).toBe(5_997);
      expect(quoted.subtotalCents).toBe(PRICE_100ML * 3 - 5_997);
    });

    it('usa o maior desconto entre o do produto e o da categoria, sem somar', async () => {
      await discounts.create({ productId: seeded.productId, minQty: 3, percentOff: 10 });
      await discounts.create({ categoryId: seeded.categoryId, minQty: 3, percentOff: 15 });

      const { body: quoted } = await quote(
        body({
          items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 3 }],
        }),
      ).expect(200);

      expect(quoted.items[0].discountPercent).toBe(15);
    });

    it('recusa a sacola vazia', async () => {
      await quote(body({ items: [] })).expect(400);
    });

    it('recusa o corpo sem entrega ou sem pagamento', async () => {
      await request(server)
        .post(QUOTE)
        .send({ items: body().items, payment: { method: PAYMENT_METHODS.PIX } })
        .expect(400);
      await request(server)
        .post(QUOTE)
        .send({ items: body().items, fulfillment: { mode: FULFILLMENT_MODES.PICKUP } })
        .expect(400);
    });
  });

  describe('pagamento', () => {
    it('trocar de PIX para cartao muda o total e a lista de parcelas', async () => {
      const pix = await quote(body()).expect(200);
      const card = await quote(
        body({ payment: { method: PAYMENT_METHODS.CARD, installments: 3 } }),
      ).expect(200);

      expect(pix.body.pixDiscountCents).toBe(1_000);
      expect(pix.body.installmentOptions).toEqual([]);

      expect(card.body.pixDiscountCents).toBe(0);
      expect(card.body.totalCents).toBe(PRICE_100ML + CITY_FEE);
      expect(card.body.totalCents).toBeGreaterThan(pix.body.totalCents);
      expect(card.body.installmentOptions.length).toBeGreaterThan(0);
      expect(card.body.payment.installments).toBe(3);
      expect(card.body.payment.selected.number).toBe(3);
    });

    it('a soma das parcelas fecha com o total', async () => {
      const { body: quoted } = await quote(
        body({ payment: { method: PAYMENT_METHODS.CARD, installments: 3 } }),
      ).expect(200);
      const { number, installmentCents, firstInstallmentCents, totalCents } =
        quoted.payment.selected;

      expect(firstInstallmentCents + installmentCents * (number - 1)).toBe(totalCents);
    });

    it('cai para a vista quando o parcelamento pedido nao cabe no total', async () => {
      const { body: quoted } = await quote(
        body({ payment: { method: PAYMENT_METHODS.CARD, installments: 12 } }),
      ).expect(200);

      // R$ 214,90 em 12x dariam parcelas de R$ 17,90, abaixo do minimo de R$ 20.
      expect(quoted.payment.installments).toBe(1);
      expect(quoted.warnings.length).toBeGreaterThan(0);
    });

    it('avisa quando a loja nao aceita a forma escolhida', async () => {
      await payments.updateOne({}, { $set: { acceptsPix: false } }).exec();

      const { body: quoted } = await quote(body()).expect(200);

      expect(quoted.pixDiscountCents).toBe(0);
      expect(quoted.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('entrega', () => {
    it('recusa a cidade que a loja nao atende mais', async () => {
      await cities.updateOne({ _id: seeded.cityId }, { $set: { isActive: false } }).exec();

      await quote(body()).expect(422);
    });

    it('zera a taxa na retirada, quando a loja a oferece', async () => {
      await store.updateOne({}, { $set: { pickupEnabled: true } }).exec();

      const { body: quoted } = await quote(
        body({ fulfillment: { mode: FULFILLMENT_MODES.PICKUP } }),
      ).expect(200);

      expect(quoted.deliveryFeeCents).toBe(0);
      expect(quoted.fulfillment.requiresAddress).toBe(false);
      expect(quoted.totalCents).toBe(PRICE_100ML - 1_000);
    });
  });

  describe('acesso', () => {
    it('responde sem autenticacao', async () => {
      await quote(body()).expect(200);
    });

    it('barra o excesso de chamadas do mesmo IP', async () => {
      for (let attempt = 0; attempt < QUOTE_RATE_LIMIT.limit; attempt += 1) {
        await quote(body()).expect(200);
      }

      await quote(body()).expect(429);
    });
  });
});
