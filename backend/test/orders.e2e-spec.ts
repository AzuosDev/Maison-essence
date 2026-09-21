import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { OrderStockService } from '../src/modules/orders/order-stock.service.js';
import { ORDER_CODE_PATTERN } from '../src/modules/orders/schemas/order-code.js';
import {
  AuditEntry,
  DeliveryCity,
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  Order,
  PAYMENT_METHODS,
  PaymentSettings,
  Product,
  RateLimitHit,
  StoreSettings,
  USER_ROLES,
  User,
} from '../src/schemas.js';

const API = '/api/v1';
const ORDERS = `${API}/orders`;
const QUOTE = `${API}/cart/quote`;
const ADMIN = `${API}/admin/orders`;
const PASSWORD = 'senha-longa-do-painel-2026';

/** A loja de teste, em centavos. */
const PRICE_100ML = 19_990;
const PRICE_LAST = 5_000;
const CITY_FEE = 1_500;
const PIX_PERCENT = 5;
const STOCK_100ML = 10;
const STORE_WHATSAPP = '5588999999999';

/** O IP padrao dos testes. O limite e por IP, entao trocar de IP e trocar de cota. */
const IP = '203.0.113.10';

interface Seeded {
  productId: string;
  /** Variante com estoque de sobra. */
  bigId: string;
  /** Variante com exatamente uma unidade: a da corrida pela ultima. */
  lastId: string;
  /** Variante esgotada, sem venda sob encomenda. */
  emptyId: string;
  cityId: string;
}

describe('pedidos (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let products: Model<Product>;
  let cities: Model<DeliveryCity>;
  let payments: Model<PaymentSettings>;
  let store: Model<StoreSettings>;
  let orders: Model<Order>;
  let hits: Model<RateLimitHit>;
  let users: Model<User>;
  let audit: Model<AuditEntry>;
  let seeded: Seeded;
  let token: string;

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
    orders = app.get<Model<Order>>(getModelToken(Order.name));
    hits = app.get<Model<RateLimitHit>>(getModelToken(RateLimitHit.name));
    users = app.get<Model<User>>(getModelToken(User.name));
    audit = app.get<Model<AuditEntry>>(getModelToken(AuditEntry.name));

    // O indice unico de `code` e o que faz a colisao de sorteio virar nova
    // tentativa. `autoIndex` so vale em desenvolvimento.
    await orders.createIndexes();

    token = await signIn();
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
      orders.deleteMany({}),
      // Todos os testes chegam do mesmo IP: sem limpar, um gastaria a cota do
      // seguinte.
      hits.deleteMany({}),
      audit.deleteMany({}),
    ]);
  });

  /** Uma dona logada no painel, criada uma vez para o arquivo inteiro. */
  async function signIn(): Promise<string> {
    const email = 'dona@maisonessence.com';

    await users.create({
      name: 'Dona',
      email,
      passwordHash: await app.get(PasswordService).hash(PASSWORD),
      role: USER_ROLES.OWNER,
      isActive: true,
      mustChangePassword: false,
    });

    const response = await request(server)
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);

    return response.body.accessToken as string;
  }

  function as(): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  async function seedStore(): Promise<Seeded> {
    const product = await products.create({
      name: 'Asad',
      slug: 'asad',
      brand: 'Lattafa',
      images: ['asad-capa'],
      variants: [
        { sku: 'ASAD-100', label: '100 ml', priceCents: PRICE_100ML, stock: STOCK_100ML },
        { sku: 'ASAD-ULT', label: 'ultima', priceCents: PRICE_LAST, stock: 1 },
        { sku: 'ASAD-50', label: '50 ml', priceCents: 9_990, stock: 0 },
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
    await store.create({
      whatsappNumber: STORE_WHATSAPP,
      pickupEnabled: true,
      pickupInstructions: 'Rua da Loja, 10 - falar com Ana',
      freeShippingMinCents: null,
    });

    return {
      productId: product._id.toHexString(),
      bigId: product.variants[0]!.id as string,
      lastId: product.variants[1]!.id as string,
      emptyId: product.variants[2]!.id as string,
      cityId: city._id.toHexString(),
    };
  }

  /** Uma unidade da variante cheia, entrega em Sobral, PIX, cliente preenchido. */
  function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 1 }],
      fulfillment: { mode: FULFILLMENT_MODES.DELIVERY, cityId: seeded.cityId },
      payment: { method: PAYMENT_METHODS.PIX, installments: 1 },
      customer: { name: 'Maria Silva', phone: '(88) 99999-9999' },
      address: {
        street: 'Rua das Flores',
        number: '123',
        district: 'Centro',
        zipCode: '62000-000',
        reference: 'perto da praca',
      },
      ...overrides,
    };
  }

  /** O total que a sacola mostraria: a mesma cotacao que o cliente veria. */
  async function quotedTotal(payload: Record<string, unknown>): Promise<number> {
    const { body: quote } = await request(server).post(QUOTE).send(payload).expect(200);

    return quote.totalCents as number;
  }

  /** Cota e envia, como o checkout faz: o total conferido e o que o cliente viu. */
  async function place(
    overrides: Record<string, unknown> = {},
    ip: string = IP,
  ): Promise<request.Response> {
    const payload = body(overrides);
    const expectedTotalCents = await quotedTotal(payload);

    return request(server)
      .post(ORDERS)
      .set('x-forwarded-for', ip)
      .send({ ...payload, expectedTotalCents });
  }

  /**
   * Confere o status de uma resposta ja resolvida.
   *
   * `place` precisa aguardar a cotacao antes de enviar o pedido, e o `Test` do
   * supertest e um thenable — devolve-lo de uma funcao `async` o resolve no
   * caminho, e o `.expect()` encadeado ja nao existe do outro lado. A
   * checagem vem para ca, levando junto o corpo do erro para o dia em que
   * falhar.
   */
  function ok(response: request.Response, status: number): request.Response {
    if (response.status !== status) {
      throw new Error(
        `esperava ${status}, recebeu ${response.status}: ${JSON.stringify(response.body)}`,
      );
    }

    return response;
  }

  /** O estoque de uma variante, lido direto do banco. */
  async function stockOf(variantId: string): Promise<number> {
    const product = await products.findById(seeded.productId).exec();

    return product?.variants.find((variant) => variant.id === variantId)?.stock ?? -1;
  }

  describe('criacao', () => {
    it('grava o pedido com os numeros do servidor', async () => {
      const { body: created } = ok(await place(), 201);

      expect(created.code).toMatch(ORDER_CODE_PATTERN);
      expect(created.orderId).toBeDefined();
      expect(created.order.status).toBe(ORDER_STATUSES.PENDING_CONTACT);
      expect(created.order.items[0].unitPriceCents).toBe(PRICE_100ML);
      expect(created.order.totals.subtotalCents).toBe(PRICE_100ML);
      expect(created.order.totals.deliveryFeeCents).toBe(CITY_FEE);
      // 5% de R$ 199,90 sao R$ 9,995, arredondados a favor de quem paga.
      expect(created.order.totals.pixDiscountCents).toBe(1_000);
      expect(created.order.totals.totalCents).toBe(PRICE_100ML - 1_000 + CITY_FEE);
    });

    it('ignora o preco adulterado que vem no corpo', async () => {
      const honest = await quotedTotal(body());
      const { body: created } = await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({
          ...body({
            items: [
              {
                productId: seeded.productId,
                variantId: seeded.bigId,
                quantity: 1,
                // O que um cliente mal-intencionado mandaria, com os nomes da
                // propria resposta.
                unitPriceCents: 1,
                lineTotalCents: 1,
                discountPercent: 90,
              },
            ],
            totals: { totalCents: 1 },
          }),
          expectedTotalCents: honest,
        })
        .expect(201);

      expect(created.order.items[0].unitPriceCents).toBe(PRICE_100ML);
      expect(created.order.totals.totalCents).toBe(honest);

      const saved = await orders.findById(created.orderId).exec();

      expect(saved?.totals.totalCents).toBe(honest);
      expect(saved?.items[0]?.unitPriceCents).toBe(PRICE_100ML);
    });

    it('recusa com 409 e a cotacao nova quando o total mudou', async () => {
      const payload = body();
      const real = await quotedTotal(payload);
      const { body: refused } = await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        // O preco subiu depois que o cliente montou a sacola.
        .send({ ...payload, expectedTotalCents: real - 5_000 })
        .expect(409);

      expect(refused.details.reason).toBe('total');
      expect(refused.details.quote.totalCents).toBe(real);
      expect(await orders.countDocuments()).toBe(0);
      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML);
    });

    it('recusa com 409 quando um item saiu da sacola', async () => {
      const payload = body({
        items: [
          { productId: seeded.productId, variantId: seeded.bigId, quantity: 1 },
          { productId: seeded.productId, variantId: seeded.emptyId, quantity: 1 },
        ],
      });
      const { body: refused } = await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({ ...payload, expectedTotalCents: await quotedTotal(payload) })
        .expect(409);

      expect(refused.details.reason).toBe('items');
      expect(refused.details.quote.items[1].unavailable).toBe(true);
      expect(await orders.countDocuments()).toBe(0);
      // O item que estava disponivel tambem nao foi baixado.
      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML);
    });

    it('baixa do estoque exatamente o que foi vendido', async () => {
      ok(await place({
        items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 3 }],
      }), 201);

      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML - 3);
    });

    it('normaliza o telefone digitado', async () => {
      const { body: created } = ok(await place(), 201);

      expect(created.order.customer.phone).toBe('88999999999');
      expect(created.order.customer.phoneLabel).toBe('(88) 99999-9999');
    });

    it('recusa o que nao e celular com DDD', async () => {
      const payload = body({ customer: { name: 'Maria Silva', phone: '8836110000' } });

      await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({ ...payload, expectedTotalCents: 1 })
        .expect(400);
    });

    it('exige o endereco na entrega', async () => {
      const payload = body();

      delete payload.address;

      await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({ ...payload, expectedTotalCents: 1 })
        .expect(400);
    });

    it('a retirada dispensa endereco e zera a taxa', async () => {
      const payload = body({ fulfillment: { mode: FULFILLMENT_MODES.PICKUP } });

      delete payload.address;

      const { body: created } = await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({ ...payload, expectedTotalCents: await quotedTotal(payload) })
        .expect(201);

      expect(created.order.fulfillment.address).toBeNull();
      expect(created.order.totals.deliveryFeeCents).toBe(0);
    });

    it('nao devolve a anotacao interna a quem comprou', async () => {
      const { body: created } = ok(await place(), 201);

      expect(created.order.notes).toBeUndefined();
    });

    it('a rota dispensa autenticacao', async () => {
      // Exigir cadastro para comprar seria perder a venda na ultima tela.
      ok(await place(), 201);
    });
  });

  describe('mensagem do WhatsApp', () => {
    it('monta a url com a mensagem legivel e quebrada em linhas', async () => {
      const { body: created } = ok(await place(), 201);
      const [base, text] = created.whatsappUrl.split('?text=');

      expect(base).toBe(`https://wa.me/${STORE_WHATSAPP}`);

      const message = decodeURIComponent(text);

      expect(message).toBe(created.order.whatsappMessage);
      expect(message).toContain('\n');
      // A quebra de linha viaja codificada: e o que impede a mensagem de
      // chegar como um paragrafo unico.
      expect(text).toContain('%0A');
      expect(message).toContain(`*NOVO PEDIDO* ${created.code}`);
      expect(message).toContain('Asad - 100 ml');
      expect(message).toContain('*TOTAL: R$ 204,90*');
      expect(message).toContain('Entrega em Sobral/CE (prazo de 2 dias uteis)');
      expect(message).toContain('Rua das Flores, 123');
      expect(message).toContain('Maria Silva');
      expect(message).toContain('(88) 99999-9999');
    });

    it('grava a mensagem no pedido, como foi enviada', async () => {
      const { body: created } = ok(await place(), 201);
      const saved = await orders.findById(created.orderId).exec();

      expect(saved?.whatsappMessage).toBe(created.order.whatsappMessage);
    });

    it('escreve as instrucoes de retirada quando nao ha entrega', async () => {
      const payload = body({ fulfillment: { mode: FULFILLMENT_MODES.PICKUP } });

      delete payload.address;

      const { body: created } = await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({ ...payload, expectedTotalCents: await quotedTotal(payload) })
        .expect(201);

      expect(created.order.whatsappMessage).toContain(
        'Retirada na loja\nRua da Loja, 10 - falar com Ana',
      );
    });

    it('sem numero cadastrado, o pedido existe e o link fica vazio', async () => {
      await store.updateOne({}, { $set: { whatsappNumber: '' } }).exec();

      const { body: created } = ok(await place(), 201);

      expect(created.whatsappUrl).toBe('');
      expect(created.order.whatsappMessage).not.toBe('');
    });
  });

  describe('corrida pela ultima unidade', () => {
    it('um pedido passa e o outro recebe 409', async () => {
      const payload = body({
        items: [{ productId: seeded.productId, variantId: seeded.lastId, quantity: 1 }],
      });
      // Os dois clientes cotaram antes: os dois viram a unidade disponivel.
      const expectedTotalCents = await quotedTotal(payload);
      const send = (phone: string): Promise<request.Response> =>
        request(server)
          .post(ORDERS)
          .set('x-forwarded-for', IP)
          .send({
            ...payload,
            customer: { name: 'Cliente', phone },
            expectedTotalCents,
          });

      const [first, second] = await Promise.all([
        send('(88) 99999-0001'),
        send('(88) 99999-0002'),
      ]);
      const status = [first.status, second.status].sort((a, b) => a - b);
      const refused = first.status === 409 ? first : second;

      expect(status).toEqual([201, 409]);
      expect(await orders.countDocuments()).toBe(1);
      expect(await stockOf(seeded.lastId)).toBe(0);
      /**
       * Dois caminhos levam ao mesmo 409, e qual deles vale depende de onde
       * as duas invocacoes se cruzaram. Se o perdedor recotou antes de o
       * vencedor baixar o estoque, e a baixa atomica que o recusa (`stock`);
       * se recotou depois, a propria cotacao ja viu o item esgotado
       * (`items`). O que nao pode acontecer e os dois passarem — e e isso que
       * a contagem de pedidos acima afirma.
       */
      expect(['stock', 'items']).toContain(refused.body.details.reason);
    });

    it('desfaz as baixas anteriores quando uma linha falha', async () => {
      // O caminho que a corrida acima so alcanca as vezes, aqui de proposito:
      // a primeira linha baixa, a segunda nao cabe no estoque, e a primeira
      // precisa voltar inteira para a prateleira.
      const stock = app.get(OrderStockService);
      const take = stock.take([
        {
          productId: seeded.productId,
          variantId: seeded.bigId,
          quantity: 2,
          allowBackorder: false,
        },
        {
          productId: seeded.productId,
          variantId: seeded.lastId,
          // So ha uma unidade desta.
          quantity: 5,
          allowBackorder: false,
        },
      ]);

      await expect(take).rejects.toMatchObject({ status: 409 });
      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML);
      expect(await stockOf(seeded.lastId)).toBe(1);
    });

    it('a venda sob encomenda baixa mesmo sem estoque', async () => {
      // Estoque negativo e a informacao certa: e quanto a dona deve buscar.
      const stock = app.get(OrderStockService);

      await stock.take([
        {
          productId: seeded.productId,
          variantId: seeded.emptyId,
          quantity: 2,
          allowBackorder: true,
        },
      ]);

      expect(await stockOf(seeded.emptyId)).toBe(-2);
    });

    it('o pedido com item esgotado nao chega a mexer no estoque', async () => {
      const payload = body({
        items: [
          { productId: seeded.productId, variantId: seeded.bigId, quantity: 2 },
          { productId: seeded.productId, variantId: seeded.lastId, quantity: 1 },
        ],
      });
      const expectedTotalCents = await quotedTotal(payload);

      // O estoque acabou depois que o cliente viu a sacola.
      await products
        .updateOne(
          { _id: seeded.productId, 'variants._id': seeded.lastId },
          { $set: { 'variants.$.stock': 0 } },
        )
        .exec();

      const { body: refused } = await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({ ...payload, expectedTotalCents })
        .expect(409);

      expect(refused.details.reason).toBe('items');
      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML);
      expect(await orders.countDocuments()).toBe(0);
    });
  });

  describe('limite de pedidos', () => {
    it('o sexto pedido do mesmo IP em dez minutos e recusado', async () => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        ok(await place({
          customer: { name: 'Cliente', phone: `(88) 9999${attempt}-0001` },
        }), 201);
      }

      ok(await place({ customer: { name: 'Cliente', phone: '(88) 98888-0009' } }), 429);
    });

    it('o sexto pedido do mesmo telefone e recusado, mesmo de outro IP', async () => {
      const phone = '(88) 97777-7777';

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        ok(await place({ customer: { name: 'Cliente', phone } }, `198.51.100.${attempt}`), 201);
      }

      ok(await place({ customer: { name: 'Cliente', phone } }, '198.51.100.99'), 429);
    });
  });

  describe('painel', () => {
    it('exige autenticacao', async () => {
      await request(server).get(ADMIN).expect(401);
    });

    it('a mudanca de status fica na trilha de auditoria', async () => {
      const { body: created } = ok(await place(), 201);

      await request(server)
        .patch(`${ADMIN}/${created.orderId}/status`)
        .set(as())
        .send({ status: ORDER_STATUSES.CONFIRMED })
        .expect(200);

      const entry = await audit.findOne({ action: 'order.status_changed' }).exec();

      expect(entry).not.toBeNull();
      expect(entry?.toJSON()).toMatchObject({
        actorEmail: 'dona@maisonessence.com',
        targetKind: 'order',
        targetId: created.orderId,
        // O codigo, e nao o id: e por ele que a dona procura o pedido.
        targetLabel: created.code,
        changes: {
          status: {
            from: ORDER_STATUSES.PENDING_CONTACT,
            to: ORDER_STATUSES.CONFIRMED,
          },
        },
      });
    });

    it('a trilha do pedido nao carrega o telefone do cliente', async () => {
      const phone = '(88) 97777-1234';

      const { body: created } = ok(await place({ customer: { name: 'Joao', phone } }), 201);

      await request(server)
        .patch(`${ADMIN}/${created.orderId}/status`)
        .set(as())
        .send({ status: ORDER_STATUSES.CANCELLED })
        .expect(200);

      const entry = await audit.findOne({ action: 'order.status_changed' }).exec();

      expect(JSON.stringify(entry?.toJSON())).not.toContain('88977771234');
    });

    it('lista do mais recente para o mais antigo, com o resumo', async () => {
      ok(await place(), 201);
      ok(await place({ customer: { name: 'Joao', phone: '(88) 98888-1234' } }), 201);

      const { body: page } = await request(server).get(ADMIN).set(as()).expect(200);

      expect(page.totalItems).toBe(2);
      expect(page.items[0].customerName).toBe('Joao');
      expect(page.items[0].itemCount).toBe(1);
      expect(page.items[0].totalCents).toBeGreaterThan(0);
    });

    it('filtra por status', async () => {
      const { body: created } = ok(await place(), 201);

      await request(server)
        .patch(`${ADMIN}/${created.orderId}/status`)
        .set(as())
        .send({ status: ORDER_STATUSES.CONFIRMED })
        .expect(200);
      ok(await place({ customer: { name: 'Joao', phone: '(88) 98888-1234' } }), 201);

      const { body: page } = await request(server)
        .get(`${ADMIN}?status=${ORDER_STATUSES.CONFIRMED}`)
        .set(as())
        .expect(200);

      expect(page.totalItems).toBe(1);
      expect(page.items[0].id).toBe(created.orderId);
    });

    it('busca pelo codigo e pelo telefone no mesmo campo', async () => {
      const { body: created } = ok(await place(), 201);

      const porCodigo = await request(server)
        .get(`${ADMIN}?q=${created.code.slice(0, 9)}`)
        .set(as())
        .expect(200);

      expect(porCodigo.body.items[0].id).toBe(created.orderId);

      const porTelefone = await request(server).get(`${ADMIN}?q=99999-9999`).set(as()).expect(200);

      expect(porTelefone.body.items[0].id).toBe(created.orderId);

      const semResultado = await request(server).get(`${ADMIN}?q=ME-000000`).set(as()).expect(200);

      expect(semResultado.body.totalItems).toBe(0);
    });

    it('filtra pelo periodo, incluindo o dia inteiro do fim', async () => {
      ok(await place(), 201);

      const hoje = new Date().toISOString().slice(0, 10);
      const { body: page } = await request(server)
        .get(`${ADMIN}?from=${hoje}&to=${hoje}`)
        .set(as())
        .expect(200);

      expect(page.totalItems).toBe(1);
    });

    it('devolve o pedido pelo id, com a anotacao interna', async () => {
      const { body: created } = ok(await place(), 201);
      const { body: found } = await request(server)
        .get(`${ADMIN}/${created.orderId}`)
        .set(as())
        .expect(200);

      expect(found.code).toBe(created.code);
      expect(found.notes).toBe('');
      expect(found.whatsappMessage).toContain('*NOVO PEDIDO*');
    });

    it('responde 404 a id inexistente ou malformado', async () => {
      await request(server).get(`${ADMIN}/nao-e-um-id`).set(as()).expect(404);
    });

    it('grava a anotacao interna', async () => {
      const { body: created } = ok(await place(), 201);
      const { body: updated } = await request(server)
        .patch(`${ADMIN}/${created.orderId}/notes`)
        .set(as())
        .send({ notes: 'Entregar depois das 18h' })
        .expect(200);

      expect(updated.notes).toBe('Entregar depois das 18h');
    });

    it('move o status', async () => {
      const { body: created } = ok(await place(), 201);
      const { body: updated } = await request(server)
        .patch(`${ADMIN}/${created.orderId}/status`)
        .set(as())
        .send({ status: ORDER_STATUSES.PREPARING })
        .expect(200);

      expect(updated.status).toBe(ORDER_STATUSES.PREPARING);
    });
  });

  describe('cancelamento', () => {
    it('repoe exatamente o estoque que o pedido baixou', async () => {
      const { body: created } = ok(await place({
        items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 3 }],
      }), 201);

      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML - 3);

      const { body: cancelled } = await request(server)
        .patch(`${ADMIN}/${created.orderId}/status`)
        .set(as())
        .send({ status: ORDER_STATUSES.CANCELLED })
        .expect(200);

      expect(cancelled.status).toBe(ORDER_STATUSES.CANCELLED);
      expect(cancelled.stockRestoredAt).not.toBeNull();
      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML);
    });

    it('cancelar duas vezes nao devolve duas vezes', async () => {
      const { body: created } = ok(await place({
        items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 3 }],
      }), 201);
      const cancel = (): request.Test =>
        request(server)
          .patch(`${ADMIN}/${created.orderId}/status`)
          .set(as())
          .send({ status: ORDER_STATUSES.CANCELLED });

      await cancel().expect(200);
      await cancel().expect(200);

      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML);
    });

    it('dois cancelamentos simultaneos devolvem uma vez so', async () => {
      const { body: created } = ok(await place({
        items: [{ productId: seeded.productId, variantId: seeded.bigId, quantity: 3 }],
      }), 201);
      const cancel = (): Promise<request.Response> =>
        request(server)
          .patch(`${ADMIN}/${created.orderId}/status`)
          .set(as())
          .send({ status: ORDER_STATUSES.CANCELLED });

      await Promise.all([cancel(), cancel()]);

      expect(await stockOf(seeded.bigId)).toBe(STOCK_100ML);
    });

    it('pedido cancelado nao volta atras', async () => {
      const { body: created } = ok(await place(), 201);

      await request(server)
        .patch(`${ADMIN}/${created.orderId}/status`)
        .set(as())
        .send({ status: ORDER_STATUSES.CANCELLED })
        .expect(200);

      await request(server)
        .patch(`${ADMIN}/${created.orderId}/status`)
        .set(as())
        .send({ status: ORDER_STATUSES.CONFIRMED })
        .expect(409);
    });
  });
});
