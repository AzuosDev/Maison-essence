import type { Connection } from 'mongoose';
import mongoose, { Types } from 'mongoose';
import {
  Category,
  CategorySchema,
  Customer,
  CustomerSchema,
  DeliveryCity,
  DeliveryCitySchema,
  FULFILLMENT_MODES,
  ORDER_CODE_PATTERN,
  ORDER_STATUSES,
  Order,
  OrderSchema,
  PAYMENT_METHODS,
  PaymentSettings,
  type PaymentSettingsModel,
  PaymentSettingsSchema,
  Product,
  ProductSchema,
  QuantityDiscount,
  QuantityDiscountSchema,
  RefreshToken,
  RefreshTokenSchema,
  StoreSettings,
  type StoreSettingsModel,
  StoreSettingsSchema,
  USER_ROLES,
  User,
  UserSchema,
} from '../src/schemas.js';

const DUPLICATE_KEY = 11000;

function uri(): string {
  const value = process.env.MONGODB_URI;

  if (!value) {
    throw new Error('MONGODB_URI ausente: o setup do mongodb-memory-server nao rodou');
  }

  return value;
}

describe('schemas (e2e)', () => {
  let connection: Connection;
  let models: ReturnType<typeof buildModels>;

  function buildModels(db: Connection) {
    return {
      users: db.model(User.name, UserSchema),
      refreshTokens: db.model(RefreshToken.name, RefreshTokenSchema),
      categories: db.model(Category.name, CategorySchema),
      products: db.model(Product.name, ProductSchema),
      quantityDiscounts: db.model(QuantityDiscount.name, QuantityDiscountSchema),
      deliveryCities: db.model(DeliveryCity.name, DeliveryCitySchema),
      storeSettings: db.model<StoreSettings, StoreSettingsModel>(
        StoreSettings.name,
        StoreSettingsSchema,
      ),
      paymentSettings: db.model<PaymentSettings, PaymentSettingsModel>(
        PaymentSettings.name,
        PaymentSettingsSchema,
      ),
      orders: db.model(Order.name, OrderSchema),
      customers: db.model(Customer.name, CustomerSchema),
    };
  }

  beforeAll(async () => {
    connection = await mongoose
      .createConnection(uri(), { dbName: 'maison-essence-schemas' })
      .asPromise();

    models = buildModels(connection);

    // Sem isso os indices unicos sobem em segundo plano e os testes de
    // duplicidade passariam por acidente, antes de o indice existir.
    await Promise.all(Object.values(models).map((model) => model.createIndexes()));
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  describe('insere e le um documento de cada colecao', () => {
    it('User', async () => {
      const created = await models.users.create({
        name: 'Dona da loja',
        email: '  DONA@maisonessence.com ',
        passwordHash: 'argon2-hash',
        role: USER_ROLES.OWNER,
      });

      const found = await models.users.findById(created._id).lean();

      expect(found?.email).toBe('dona@maisonessence.com');
      expect(found?.role).toBe(USER_ROLES.OWNER);
      expect(found?.mustChangePassword).toBe(true);
      expect(found?.credentialVersion).toBe(1);
      expect(found?.createdAt).toBeInstanceOf(Date);
    });

    it('RefreshToken', async () => {
      const user = await models.users.create({
        name: 'Sessao',
        email: 'sessao@maisonessence.com',
        passwordHash: 'hash',
      });

      const created = await models.refreshTokens.create({
        userId: user._id,
        tokenHash: 'sha256-do-token',
        expiresAt: new Date(Date.now() + 604_800_000),
        userAgent: 'Chrome',
      });

      const found = await models.refreshTokens.findById(created._id).lean();

      expect(found?.userId.toString()).toBe(user._id.toString());
      expect(found?.revokedAt).toBeNull();
      // `select: false`: o hash so vem quando pedido.
      expect(found?.tokenHash).toBeUndefined();
    });

    it('Category', async () => {
      const created = await models.categories.create({ name: 'Perfumes Árabes' });
      const found = await models.categories.findById(created._id).lean();

      expect(found?.slug).toBe('perfumes-arabes');
      expect(found?.isActive).toBe(true);
      expect(found?.parentId).toBeNull();
    });

    it('Product', async () => {
      const category = await models.categories.create({ name: 'Decants' });

      const created = await models.products.create({
        name: 'Asad Lattafa',
        brand: 'Lattafa',
        description: 'Amadeirado intenso.',
        categoryIds: [category._id],
        images: ['maison-essence/products/asad'],
        variants: [
          { sku: 'asad-100', priceCents: 19_990, compareAtPriceCents: 29_990, stock: 7 },
          { sku: 'asad-decant', label: '10ml', priceCents: 4990, stock: 20 },
        ],
      });

      const found = await models.products.findById(created._id);

      expect(found?.slug).toBe('asad-lattafa');
      expect(found?.variants).toHaveLength(2);
      // `uppercase` normaliza o SKU na gravacao.
      expect(found?.variants[0].sku).toBe('ASAD-100');
      expect(found?.variants[0].priceCents).toBe(19_990);
    });

    it('QuantityDiscount', async () => {
      const product = await models.products.create({
        name: 'Vela de figo',
        variants: [{ sku: 'vela-figo', priceCents: 8900 }],
      });

      const created = await models.quantityDiscounts.create({
        productId: product._id,
        minQty: 3,
        percentOff: 10,
      });

      const found = await models.quantityDiscounts.findById(created._id).lean();

      expect(found?.percentOff).toBe(10);
      expect(found?.categoryId).toBeNull();
    });

    it('DeliveryCity', async () => {
      const created = await models.deliveryCities.create({
        name: 'Juazeiro do Norte',
        state: 'ce',
        feeCents: 1000,
        estimatedDays: 2,
      });

      const found = await models.deliveryCities.findById(created._id).lean();

      expect(found?.state).toBe('CE');
      expect(found?.feeCents).toBe(1000);
      expect(found?.minOrderForFreeCents).toBeNull();
    });

    it('StoreSettings', async () => {
      const created = await models.storeSettings.getOrCreate();

      await models.storeSettings.updateOne(
        { _id: created._id },
        {
          $set: {
            whatsappNumber: '5588999999999',
            banners: [{ imageDesktop: 'maison-essence/banners/verao' }],
          },
        },
      );

      const found = await models.storeSettings.findById(created._id).lean();

      expect(found?.storeName).toBe('Maison Essence');
      expect(found?.whatsappNumber).toBe('5588999999999');
      expect(found?.banners).toHaveLength(1);
      // Subdocumento singular materializado com os proprios defaults.
      expect(found?.pickupAddress.city).toBe('');
    });

    it('PaymentSettings', async () => {
      const created = await models.paymentSettings.getOrCreate();
      const found = await models.paymentSettings.findById(created._id).lean();

      expect(found?.maxInstallments).toBe(12);
      expect(found?.interestFreeUpTo).toBe(3);
      expect(found?.minInstallmentCents).toBe(2000);
      expect(found?.acceptsPix).toBe(true);
    });

    it('Order', async () => {
      const created = await models.orders.create(orderFixture());
      const found = await models.orders.findById(created._id).lean();

      expect(found?.code).toMatch(ORDER_CODE_PATTERN);
      expect(found?.status).toBe(ORDER_STATUSES.PENDING_CONTACT);
      expect(found?.totals.totalCents).toBe(20_990);
      expect(found?.items[0].productName).toBe('Asad Lattafa');
    });

    it('Customer', async () => {
      const created = await models.customers.create({
        name: 'Cliente',
        phone: '88999999999',
        passwordHash: 'hash',
        addresses: [{ label: 'Casa', street: 'Rua das Flores', isDefault: true }],
      });

      const found = await models.customers.findById(created._id).lean();

      expect(found?.phone).toBe('88999999999');
      expect(found?.addresses).toHaveLength(1);
      expect(found?.addresses[0].isDefault).toBe(true);
    });
  });

  describe('dinheiro em centavos', () => {
    it('rejeita preco com casa decimal na criacao', async () => {
      await expect(
        models.products.create({
          name: 'Preco errado',
          variants: [{ sku: 'errado', priceCents: 199.9 }],
        }),
      ).rejects.toThrow(/19990/);
    });

    it('rejeita preco com casa decimal tambem no update por query', async () => {
      const city = await models.deliveryCities.create({
        name: 'Crato',
        state: 'CE',
        feeCents: 1500,
      });

      // O Mongoose nao valida `findOneAndUpdate` por padrao; quem liga isso e
      // o `createSchema`. Sem ele, o PATCH do painel seria a porta de entrada
      // do valor decimal.
      await expect(
        models.deliveryCities.findByIdAndUpdate(city._id, { feeCents: 19.9 }),
      ).rejects.toThrow(/inteiro em centavos/);
    });
  });

  describe('slug', () => {
    it('nao muda quando o nome muda depois', async () => {
      const product = await models.products.create({
        name: 'Nome original',
        variants: [{ sku: 'orig', priceCents: 1000 }],
      });

      product.name = 'Nome novo depois de divulgado';
      await product.save();

      expect(product.slug).toBe('nome-original');
    });

    it('resolve homonimo com sufixo em vez de estourar o indice unico', async () => {
      const first = await models.categories.create({ name: 'Importados' });
      const second = await models.categories.create({ name: 'Importados' });

      expect(first.slug).toBe('importados');
      expect(second.slug).toBe('importados-2');
    });
  });

  describe('regras de integridade', () => {
    it('produto sem variante nao existe', async () => {
      await expect(models.products.create({ name: 'Sem variante' })).rejects.toThrow(
        /ao menos uma variante/,
      );
    });

    it('SKU repetido dentro do mesmo produto e recusado', async () => {
      await expect(
        models.products.create({
          name: 'SKU repetido',
          variants: [
            { sku: 'igual', priceCents: 1000 },
            { sku: 'igual', priceCents: 2000 },
          ],
        }),
      ).rejects.toThrow(/mais de uma vez/);
    });

    it('preco de comparacao precisa ser maior que o de venda', async () => {
      await expect(
        models.products.create({
          name: 'Desconto negativo',
          variants: [{ sku: 'neg', priceCents: 10_000, compareAtPriceCents: 9000 }],
        }),
      ).rejects.toThrow(/maior que o preco de venda/);
    });

    it('desconto por quantidade aponta para produto ou categoria, nunca os dois', async () => {
      await expect(
        models.quantityDiscounts.create({
          productId: new Types.ObjectId(),
          categoryId: new Types.ObjectId(),
          minQty: 3,
          percentOff: 5,
        }),
      ).rejects.toThrow(/exatamente um dos dois/);
    });

    it('codigo de pedido repetido bate no indice unico', async () => {
      const first = await models.orders.create(orderFixture());

      await expect(
        models.orders.create({ ...orderFixture(), code: first.code }),
      ).rejects.toMatchObject({ code: DUPLICATE_KEY });
    });
  });

  describe('documentos unicos', () => {
    it('getOrCreate devolve sempre o mesmo documento', async () => {
      const first = await models.storeSettings.getOrCreate();
      const second = await models.storeSettings.getOrCreate();

      expect(second._id.toString()).toBe(first._id.toString());
      expect(await models.storeSettings.countDocuments()).toBe(1);
    });

    it('ler nao envelhece o documento', async () => {
      const first = await models.storeSettings.getOrCreate();
      const second = await models.storeSettings.getOrCreate();

      // `updatedAt` e data de alteracao, nunca de leitura: e ela que versiona o
      // ETag da rota publica de configuracoes. Se cada leitura a movesse, a CDN
      // nunca receberia um 304 e a vitrine escreveria no banco a cada visita.
      expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
    });

    it('o indice unico impede um segundo documento', async () => {
      await models.paymentSettings.getOrCreate();

      await expect(models.paymentSettings.create({})).rejects.toMatchObject({
        code: DUPLICATE_KEY,
      });
    });
  });

  describe('serializacao', () => {
    it('troca _id por id, inclusive nas variantes', async () => {
      const product = await models.products.create({
        name: 'Serializado',
        variants: [{ sku: 'ser', priceCents: 1000 }],
      });

      const json = product.toJSON() as unknown as Record<string, unknown>;
      const variants = json.variants as Record<string, unknown>[];

      expect(json).not.toHaveProperty('_id');
      expect(json).not.toHaveProperty('__v');
      expect(typeof json.id).toBe('string');
      expect(variants[0]).not.toHaveProperty('_id');
      expect(typeof variants[0].id).toBe('string');
    });
  });
});

function orderFixture(): Record<string, unknown> {
  return {
    items: [
      {
        productId: new Types.ObjectId(),
        variantId: new Types.ObjectId(),
        productName: 'Asad Lattafa',
        variantLabel: '100ml',
        unitPriceCents: 19_990,
        quantity: 1,
        discountPercent: 0,
        lineTotalCents: 19_990,
      },
    ],
    customer: { name: 'Cliente', phone: '88999999999' },
    fulfillment: {
      mode: FULFILLMENT_MODES.DELIVERY,
      cityId: new Types.ObjectId(),
      cityName: 'Juazeiro do Norte',
      state: 'CE',
      estimatedDays: 2,
      address: { street: 'Rua das Flores', number: '10' },
    },
    payment: { method: PAYMENT_METHODS.PIX, installments: 1 },
    totals: {
      subtotalCents: 19_990,
      deliveryFeeCents: 1000,
      totalCents: 20_990,
    },
  };
}
