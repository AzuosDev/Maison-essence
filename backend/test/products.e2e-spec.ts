import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import {
  AuditEntry,
  Category,
  FULFILLMENT_MODES,
  Order,
  PAYMENT_METHODS,
  Product,
  USER_ROLES,
  User,
  type UserRole,
} from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

describe('products (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let products: Model<Product>;
  let categories: Model<Category>;
  let orders: Model<Order>;
  let audit: Model<AuditEntry>;
  let passwordHash: string;
  let owner: { Authorization: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    products = app.get<Model<Product>>(getModelToken(Product.name));
    categories = app.get<Model<Category>>(getModelToken(Category.name));
    orders = app.get<Model<Order>>(getModelToken(Order.name));
    audit = app.get<Model<AuditEntry>>(getModelToken(AuditEntry.name));
    passwordHash = await app.get(PasswordService).hash(PASSWORD);

    // `autoIndex` so vale em desenvolvimento (ver `database.module`), e a
    // busca por termo longo depende do indice de texto. Em producao quem os
    // cria e o seed, antes de qualquer gravacao.
    await products.createIndexes();

    owner = await signIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await Promise.all([
      products.deleteMany({}),
      categories.deleteMany({}),
      orders.deleteMany({}),
      audit.deleteMany({}),
    ]);
  });

  async function signIn(role: UserRole, email: string): Promise<{ Authorization: string }> {
    await users.create({
      name: `Usuario ${role}`,
      email,
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: false,
    });

    const response = await request(server)
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);

    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  async function create(body: Record<string, unknown>): Promise<Record<string, any>> {
    const response = await request(server)
      .post(`${API}/admin/products`)
      .set(owner)
      .send({ variants: [{ priceCents: 19_990 }], ...body })
      .expect(201);

    return response.body;
  }

  function patch(id: string, body: Record<string, unknown>): request.Test {
    return request(server).patch(`${API}/admin/products/${id}`).set(owner).send(body);
  }

  /**
   * Pedido direto no model: o modulo de pedidos ainda nao existe, e o que
   * importa aqui e so o vinculo com a variante.
   */
  async function placeOrder(productId: string, variantId: string): Promise<void> {
    await orders.create({
      items: [
        {
          productId: productId as unknown as Types.ObjectId,
          variantId: variantId as unknown as Types.ObjectId,
          productName: 'Asad Lattafa',
          unitPriceCents: 19_990,
          quantity: 1,
          lineTotalCents: 19_990,
        },
      ],
      customer: { name: 'Cliente', phone: '85999990000' },
      fulfillment: { mode: FULFILLMENT_MODES.DELIVERY },
      payment: { method: PAYMENT_METHODS.PIX },
      totals: { subtotalCents: 19_990, totalCents: 19_990 },
    });
  }

  describe('POST /admin/products', () => {
    it('devolve priceRangeCents com o menor e o maior preco', async () => {
      const created = await create({
        name: 'Asad Lattafa',
        variants: [
          { label: '100 ml', priceCents: 24_990 },
          { label: 'Decant 10 ml', priceCents: 4990 },
          { label: '50 ml', priceCents: 14_990 },
        ],
      });

      expect(created.priceRangeCents).toEqual({ min: 4990, max: 24_990 });
      expect(created.hasVariants).toBe(true);
      expect(created.variants).toHaveLength(3);
    });

    it('gera o SKU que faltar, a partir do nome e do label', async () => {
      const created = await create({
        name: 'Vela de figo',
        variants: [{ label: '', priceCents: 8900 }, { label: '200 g', priceCents: 12_900 }],
      });

      expect(created.variants.map((variant: { sku: string }) => variant.sku)).toEqual([
        'VELA-DE-FIGO',
        'VELA-DE-FIGO-200-G',
      ]);
    });

    it('respeita o SKU informado', async () => {
      const created = await create({
        name: 'Asad',
        variants: [{ sku: 'asad-100', label: '100 ml', priceCents: 24_990 }],
      });

      expect(created.variants[0].sku).toBe('ASAD-100');
    });

    it('esconde a variante unica sem label atras de hasVariants', async () => {
      const created = await create({ name: 'Vela de figo' });

      expect(created.hasVariants).toBe(false);
      expect(created.variants).toHaveLength(1);
    });

    it('recusa com 422 produto sem variante', async () => {
      const response = await request(server)
        .post(`${API}/admin/products`)
        .set(owner)
        .send({ name: 'Fantasma', variants: [] })
        .expect(422);

      expect(String(response.body.message)).toContain('ao menos uma variante');
    });

    it('recusa com 422 preco de comparacao menor que o de venda', async () => {
      const response = await request(server)
        .post(`${API}/admin/products`)
        .set(owner)
        .send({
          name: 'Asad',
          variants: [{ priceCents: 24_990, compareAtPriceCents: 19_990 }],
        })
        .expect(422);

      expect(String(response.body.message)).toContain(
        'preco de comparacao precisa ser maior',
      );
    });

    it('calcula o maior desconto e a capa', async () => {
      const created = await create({
        name: 'Asad',
        images: ['maison-essence/products/asad-1', 'maison-essence/products/asad-2'],
        variants: [
          { label: '100 ml', priceCents: 19_990, compareAtPriceCents: 29_990 },
          { label: '50 ml', priceCents: 14_990 },
        ],
      });

      expect(created.discountPercent).toBe(33);
      expect(created.coverImage).toBe('maison-essence/products/asad-1');
    });

    it('exige papel que gerencia a loja', async () => {
      const staff = await signIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await request(server)
        .post(`${API}/admin/products`)
        .set(staff)
        .send({ name: 'Asad', variants: [{ priceCents: 100 }] })
        .expect(403);

      await request(server).get(`${API}/admin/products`).set(staff).expect(200);
    });
  });

  describe('estoque', () => {
    it('zerar o estoque de todas as variantes faz inStock virar false', async () => {
      const created = await create({
        name: 'Asad',
        variants: [
          { label: '100 ml', priceCents: 24_990, stock: 4 },
          { label: '50 ml', priceCents: 14_990, stock: 2 },
        ],
      });

      expect(created.inStock).toBe(true);
      expect(created.totalStock).toBe(6);

      const response = await patch(created.id, {
        variants: created.variants.map((variant: { id: string; priceCents: number }) => ({
          id: variant.id,
          priceCents: variant.priceCents,
          stock: 0,
        })),
      }).expect(200);

      expect(response.body.inStock).toBe(false);
      expect(response.body.totalStock).toBe(0);
    });

    it('variante com allowBackorder continua disponivel sem estoque', async () => {
      const created = await create({
        name: 'Khamrah',
        variants: [{ priceCents: 27_990, stock: 0, allowBackorder: true }],
      });

      expect(created.inStock).toBe(true);
      expect(created.variants[0].isAvailable).toBe(true);
    });
  });

  describe('trilha de preco', () => {
    it('registra quem mudou o preco, de quanto para quanto', async () => {
      const created = await create({
        name: 'Asad',
        variants: [{ label: '100 ml', sku: 'ASAD-100', priceCents: 24_990 }],
      });

      await patch(created.id, {
        variants: [{ id: created.variants[0].id, priceCents: 19_990 }],
      }).expect(200);

      const entry = await audit.findOne({ action: 'product.price_changed' }).exec();

      expect(entry).not.toBeNull();
      expect(entry?.toJSON()).toMatchObject({
        actorEmail: 'dona@maisonessence.com',
        targetKind: 'product',
        targetId: created.id,
        targetLabel: 'Asad',
        changes: { 'ASAD-100.priceCents': { from: 24_990, to: 19_990 } },
      });
    });

    it('editar o produto sem mexer no preco nao vira linha na trilha', async () => {
      const created = await create({ name: 'Asad' });

      await patch(created.id, { description: 'Amadeirado' }).expect(200);

      expect(await audit.countDocuments({ action: 'product.price_changed' })).toBe(0);
    });
  });

  describe('PATCH /admin/products/:id (diff de variantes)', () => {
    it('remove a variante que sumiu da lista', async () => {
      const created = await create({
        name: 'Asad',
        variants: [
          { label: '100 ml', priceCents: 24_990 },
          { label: '10 ml', priceCents: 4990 },
        ],
      });

      const response = await patch(created.id, {
        variants: [{ id: created.variants[0].id, priceCents: 24_990 }],
      }).expect(200);

      expect(response.body.variants).toHaveLength(1);
    });

    it('desativa, em vez de apagar, a variante que ja aparece em pedido', async () => {
      const created = await create({
        name: 'Asad Lattafa',
        variants: [
          { label: '100 ml', priceCents: 24_990 },
          { label: '10 ml', priceCents: 4990 },
        ],
      });
      const vendida = created.variants[1];

      await placeOrder(created.id, vendida.id);

      const response = await patch(created.id, {
        variants: [{ id: created.variants[0].id, priceCents: 24_990 }],
      }).expect(200);

      expect(response.body.variants).toHaveLength(2);
      const aposentada = response.body.variants.find(
        (variant: { id: string }) => variant.id === vendida.id,
      );

      expect(aposentada).toMatchObject({ id: vendida.id, isActive: false });
      // Desativada sai das contas da vitrine.
      expect(response.body.priceRangeCents).toEqual({ min: 24_990, max: 24_990 });
    });

    it('cria a variante que chega sem id e mantem a que tem', async () => {
      const created = await create({ name: 'Asad', variants: [{ priceCents: 24_990 }] });

      const response = await patch(created.id, {
        variants: [
          { id: created.variants[0].id, priceCents: 24_990, label: '100 ml' },
          { priceCents: 4990, label: '10 ml' },
        ],
      }).expect(200);

      expect(response.body.variants).toHaveLength(2);
      expect(response.body.variants[0].id).toBe(created.variants[0].id);
      expect(response.body.variants[1].sku).toBe('ASAD-10-ML');
    });

    it('preserva o campo omitido da variante', async () => {
      const created = await create({
        name: 'Asad',
        variants: [{ priceCents: 24_990, stock: 7, allowBackorder: true }],
      });

      const response = await patch(created.id, {
        variants: [{ id: created.variants[0].id, priceCents: 21_990 }],
      }).expect(200);

      expect(response.body.variants[0]).toMatchObject({
        priceCents: 21_990,
        stock: 7,
        allowBackorder: true,
      });
    });

    it('recusa com 422 id de variante de outro produto', async () => {
      const created = await create({ name: 'Asad' });
      const outro = await create({ name: 'Khamrah' });

      await patch(created.id, {
        variants: [{ id: outro.variants[0].id, priceCents: 100 }],
      }).expect(422);
    });

    it('recusa com 422 esvaziar a lista de variantes', async () => {
      const created = await create({ name: 'Asad' });

      await patch(created.id, { variants: [] }).expect(422);
    });
  });

  describe('GET /admin/products', () => {
    it('pagina e devolve a contagem', async () => {
      await create({ name: 'Asad' });
      await create({ name: 'Khamrah' });
      await create({ name: 'Yara' });

      const response = await request(server)
        .get(`${API}/admin/products`)
        .query({ page: 1, limit: 2 })
        .set(owner)
        .expect(200);

      expect(response.body).toMatchObject({
        page: 1,
        totalPages: 2,
        totalItems: 3,
        hasMore: true,
      });
      expect(response.body.items).toHaveLength(2);
    });

    it('filtra por categoria e por status', async () => {
      const category = await categories.create({ name: 'Perfumes Arabes' });
      const categoryId = category._id.toHexString();

      const asad = await create({ name: 'Asad', categoryIds: [categoryId] });
      await create({ name: 'Vela de figo' });

      const daCategoria = await request(server)
        .get(`${API}/admin/products`)
        .query({ categoryId })
        .set(owner)
        .expect(200);

      expect(daCategoria.body.items).toHaveLength(1);
      expect(daCategoria.body.items[0].id).toBe(asad.id);

      await request(server)
        .patch(`${API}/admin/products/${asad.id}/status`)
        .set(owner)
        .send({ isActive: false })
        .expect(200);

      const inativos = await request(server)
        .get(`${API}/admin/products`)
        .query({ status: 'inactive' })
        .set(owner)
        .expect(200);

      expect(inativos.body.items.map((item: { id: string }) => item.id)).toEqual([asad.id]);
    });

    it('busca pelo indice de texto em nome e marca', async () => {
      await create({ name: 'Asad Lattafa', brand: 'Lattafa' });
      await create({ name: 'Vela de figo', brand: 'Maison' });

      const response = await request(server)
        .get(`${API}/admin/products`)
        .query({ q: 'asad' })
        .set(owner)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Asad Lattafa');
    });

    it('cai no regex quando o termo e curto demais para o indice', async () => {
      await create({ name: 'Asad Lattafa' });
      await create({ name: 'Vela de figo' });

      const response = await request(server)
        .get(`${API}/admin/products`)
        .query({ q: 'as' })
        .set(owner)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Asad Lattafa');
    });
  });

  describe('PATCH /admin/products/:id/status', () => {
    it('liga e desliga o produto', async () => {
      const created = await create({ name: 'Asad' });

      const response = await request(server)
        .patch(`${API}/admin/products/${created.id}/status`)
        .set(owner)
        .send({ isActive: false })
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });
  });

  describe('DELETE /admin/products/:id', () => {
    it('exclui produto que nunca foi vendido', async () => {
      const created = await create({ name: 'Asad' });

      await request(server)
        .delete(`${API}/admin/products/${created.id}`)
        .set(owner)
        .expect(204);

      expect(await products.countDocuments()).toBe(0);
    });

    it('responde 409 com a contagem de pedidos quando o produto ja foi vendido', async () => {
      const created = await create({ name: 'Asad' });

      await placeOrder(created.id, created.variants[0].id);

      const response = await request(server)
        .delete(`${API}/admin/products/${created.id}`)
        .set(owner)
        .expect(409);

      expect(response.body.details).toMatchObject({ orderCount: 1, canDeactivate: true });
      expect(await products.countDocuments()).toBe(1);
    });

    it('responde 404 para id que nao existe', async () => {
      await request(server)
        .delete(`${API}/admin/products/64b7f1c2a1b2c3d4e5f60718`)
        .set(owner)
        .expect(404);
    });
  });
});
