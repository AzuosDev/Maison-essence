import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { MailService } from '../src/modules/mail/mail.service.js';
import type { Mail } from '../src/modules/mail/mail.service.js';
import { PasswordResetToken } from '../src/schemas.js';
import {
  Customer,
  DeliveryCity,
  FULFILLMENT_MODES,
  Order,
  PAYMENT_METHODS,
  PaymentSettings,
  Product,
  RateLimitHit,
  RefreshToken,
  StoreSettings,
  USER_ROLES,
  User,
} from '../src/schemas.js';

const API = '/api/v1';
const CUSTOMER = `${API}/customer`;
const ORDERS = `${API}/orders`;
const QUOTE = `${API}/cart/quote`;

const PRICE = 19_990;
const CITY_FEE = 1_500;
const PASSWORD = 'senha-da-loja-2026';
const ADMIN_PASSWORD = 'senha-longa-do-painel-2026';

/** O telefone do cliente, nos dois formatos que circulam. */
const PHONE_TYPED = '(88) 99999-1234';
const PHONE_STORED = '88999991234';

interface Seeded {
  productId: string;
  variantId: string;
  cityId: string;
}

describe('contas de cliente (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let products: Model<Product>;
  let cities: Model<DeliveryCity>;
  let payments: Model<PaymentSettings>;
  let store: Model<StoreSettings>;
  let orders: Model<Order>;
  let customers: Model<Customer>;
  let refreshTokens: Model<RefreshToken>;
  let hits: Model<RateLimitHit>;
  let users: Model<User>;
  let resets: Model<PasswordResetToken>;
  let mail: MailService;
  /** O que o `MailService` teria mandado. Alimentado pelo spy, abaixo. */
  let sent: Mail[];
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
    orders = app.get<Model<Order>>(getModelToken(Order.name));
    customers = app.get<Model<Customer>>(getModelToken(Customer.name));
    refreshTokens = app.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));
    hits = app.get<Model<RateLimitHit>>(getModelToken(RateLimitHit.name));
    users = app.get<Model<User>>(getModelToken(User.name));
    resets = app.get<Model<PasswordResetToken>>(getModelToken(PasswordResetToken.name));
    mail = app.get(MailService);

    // O telefone unico e o que impede duas contas de disputarem os mesmos
    // pedidos. `autoIndex` so vale em desenvolvimento.
    await customers.createIndexes();
    await orders.createIndexes();
    await resets.createIndexes();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    seeded = await seedStore();

    /*
     * O e-mail e interceptado, e nao enviado.
     *
     * E tambem a unica forma de o teste ver o token: o que fica no banco e o
     * hash dele, de proposito. Ler a mensagem e o mesmo que o cliente faz —
     * abre a caixa de entrada e clica no link —, e por isso o teste do fluxo
     * inteiro passa por aqui em vez de alcancar a coleção por dentro.
     */
    sent = [];
    vi.spyOn(mail, 'send').mockImplementation(async (message: Mail) => {
      sent.push(message);

      return true;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    await Promise.all([
      resets.deleteMany({}),
      products.deleteMany({}),
      cities.deleteMany({}),
      payments.deleteMany({}),
      store.deleteMany({}),
      orders.deleteMany({}),
      customers.deleteMany({}),
      refreshTokens.deleteMany({}),
      users.deleteMany({}),
      // Todos os testes chegam do mesmo IP: sem limpar, um gastaria a cota do
      // seguinte.
      hits.deleteMany({}),
    ]);
  });

  async function seedStore(): Promise<Seeded> {
    const product = await products.create({
      name: 'Asad',
      slug: 'asad',
      images: ['asad-capa'],
      variants: [{ sku: 'ASAD-100', label: '100 ml', priceCents: PRICE, stock: 20 }],
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
      pixDiscountPercent: 0,
      acceptsCard: true,
      maxInstallments: 12,
      interestFreeUpTo: 3,
      monthlyInterestPercent: 0,
      minInstallmentCents: 2_000,
    });
    await store.create({ whatsappNumber: '5588999999999', freeShippingMinCents: null });

    return {
      productId: product._id.toHexString(),
      variantId: product.variants[0]!.id as string,
      cityId: city._id.toHexString(),
    };
  }

  /** O corpo do cadastro, com o telefone do jeito que o cliente digita. */
  function registration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: 'Maria Silva',
      phone: PHONE_TYPED,
      email: 'maria@exemplo.com',
      password: PASSWORD,
      ...overrides,
    };
  }

  /** Cadastra e devolve a sessao. */
  async function signUp(
    overrides: Record<string, unknown> = {},
  ): Promise<{ accessToken: string; refreshToken: string; customerId: string }> {
    const { body } = await request(server)
      .post(`${CUSTOMER}/register`)
      .send(registration(overrides))
      .expect(201);

    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      customerId: body.customer.id,
    };
  }

  function as(accessToken: string): { Authorization: string } {
    return { Authorization: `Bearer ${accessToken}` };
  }

  /** Uma dona do painel logada, para provar que as duas portas nao se cruzam. */
  async function adminToken(): Promise<string> {
    const email = 'dona@maisonessence.com';

    await users.create({
      name: 'Dona',
      email,
      passwordHash: await app.get(PasswordService).hash(ADMIN_PASSWORD),
      role: USER_ROLES.OWNER,
      isActive: true,
      mustChangePassword: false,
    });

    const { body } = await request(server)
      .post(`${API}/auth/login`)
      .send({ email, password: ADMIN_PASSWORD })
      .expect(200);

    return body.accessToken as string;
  }

  /** O corpo do checkout, com o telefone do cliente. */
  function orderBody(phone: string = PHONE_TYPED): Record<string, unknown> {
    return {
      items: [{ productId: seeded.productId, variantId: seeded.variantId, quantity: 1 }],
      fulfillment: { mode: FULFILLMENT_MODES.DELIVERY, cityId: seeded.cityId },
      payment: { method: PAYMENT_METHODS.PIX, installments: 1 },
      customer: { name: 'Maria Silva', phone },
      address: { street: 'Rua das Flores', number: '123', district: 'Centro' },
    };
  }

  /**
   * Fecha um pedido, com ou sem sessao.
   *
   * Sem `accessToken` e exatamente o checkout como convidado: nenhum cabecalho
   * de autenticacao sai daqui.
   */
  async function placeOrder(
    accessToken?: string,
    phone: string = PHONE_TYPED,
  ): Promise<{ code: string; orderId: string }> {
    const payload = orderBody(phone);
    const { body: quote } = await request(server).post(QUOTE).send(payload).expect(200);
    const post = request(server).post(ORDERS);

    if (accessToken !== undefined) {
      post.set(as(accessToken));
    }

    const { body: created } = await post
      .send({ ...payload, expectedTotalCents: quote.totalCents })
      .expect(201);

    return { code: created.code, orderId: created.orderId };
  }

  describe('cadastro', () => {
    it('cria a conta e devolve a sessao', async () => {
      const { body } = await request(server)
        .post(`${CUSTOMER}/register`)
        .send(registration())
        .expect(201);

      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.tokenType).toBe('Bearer');
      expect(body.customer.name).toBe('Maria Silva');
      // Guardado so com digitos, como o pedido guarda: e a mesma chave.
      expect(body.customer.phone).toBe(PHONE_STORED);
      expect(body.customer.phoneLabel).toBe('(88) 99999-1234');
    });

    it('nao devolve a senha nem o contador de credencial', async () => {
      const { body } = await request(server)
        .post(`${CUSTOMER}/register`)
        .send(registration())
        .expect(201);

      expect(body.customer.passwordHash).toBeUndefined();
      expect(body.customer.credentialVersion).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain(PASSWORD);
    });

    it('nao emite nada que lembre papel administrativo', async () => {
      const { body } = await request(server)
        .post(`${CUSTOMER}/register`)
        .send(registration())
        .expect(201);
      const [, payload] = (body.accessToken as string).split('.');
      const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString());

      expect(claims.role).toBeUndefined();
      expect(claims.aud).toBe('maison-essence/customer');
    });

    it('recusa telefone ja cadastrado, mandando para o login', async () => {
      await signUp();

      const { body } = await request(server)
        .post(`${CUSTOMER}/register`)
        .send(registration({ email: 'outra@exemplo.com' }))
        .expect(409);

      expect(body.message).toContain('Entre com a sua senha');
    });

    it('recusa e-mail ja cadastrado', async () => {
      await signUp();

      await request(server)
        .post(`${CUSTOMER}/register`)
        .send(registration({ phone: '(88) 98888-4321' }))
        .expect(409);
    });

    it('recusa telefone que nao e celular e senha curta', async () => {
      await request(server)
        .post(`${CUSTOMER}/register`)
        .send(registration({ phone: '8836110000' }))
        .expect(400);
      await request(server)
        .post(`${CUSTOMER}/register`)
        .send(registration({ password: 'curta' }))
        .expect(400);
    });
  });

  describe('login e sessao', () => {
    it('entra pelo e-mail do cadastro, do jeito que a tela o mostra', async () => {
      await signUp();

      const { body } = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: 'MARIA@exemplo.com', password: PASSWORD })
        .expect(200);

      expect(body.customer.email).toBe('maria@exemplo.com');
      expect(body.accessToken).toBeDefined();
    });

    it('e-mail sem conta recusa igual a telefone sem conta', async () => {
      await signUp();

      const semConta = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: 'ninguem@maisonessence.test', password: PASSWORD })
        .expect(401);
      const telefoneSemConta = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: '(88) 97777-0000', password: PASSWORD })
        .expect(401);

      expect(semConta.body.message).toBe(telefoneSemConta.body.message);
    });

    it('recusa com 400 o que nao e telefone nem e-mail', async () => {
      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: 'felipe', password: PASSWORD })
        .expect(400);
    });

    it('entra pelo telefone, digitado de qualquer jeito', async () => {
      await signUp();

      const { body } = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_STORED, password: PASSWORD })
        .expect(200);

      expect(body.customer.phone).toBe(PHONE_STORED);
      expect(body.accessToken).toBeDefined();
    });

    it('recusa senha errada e telefone sem conta com a mesma resposta', async () => {
      await signUp();

      const errada = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: 'outra-senha-qualquer' })
        .expect(401);
      const inexistente = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: '(88) 97777-0000', password: PASSWORD })
        .expect(401);

      expect(errada.body.message).toBe(inexistente.body.message);
    });

    it('renova a sessao e invalida o refresh usado', async () => {
      const { refreshToken } = await signUp();
      const { body: renovada } = await request(server)
        .post(`${CUSTOMER}/refresh`)
        .send({ refreshToken })
        .expect(200);

      expect(renovada.refreshToken).not.toBe(refreshToken);

      // Rotacao: o token anterior morreu ao ser usado.
      await request(server).post(`${CUSTOMER}/refresh`).send({ refreshToken }).expect(401);
    });

    it('reuso de refresh token derruba todas as sessoes da conta', async () => {
      const { refreshToken } = await signUp();
      const { body: renovada } = await request(server)
        .post(`${CUSTOMER}/refresh`)
        .send({ refreshToken })
        .expect(200);

      // O token velho aparece de novo: alguem copiou a sessao.
      await request(server).post(`${CUSTOMER}/refresh`).send({ refreshToken }).expect(401);

      // A sessao legitima cai junto, porque nao da para saber qual e qual.
      await request(server)
        .post(`${CUSTOMER}/refresh`)
        .send({ refreshToken: renovada.refreshToken })
        .expect(401);
      await request(server).get(`${CUSTOMER}/me`).set(as(renovada.accessToken)).expect(401);
    });

    it('conta desativada perde o acesso na hora', async () => {
      const { accessToken, customerId } = await signUp();

      await customers.updateOne({ _id: customerId }, { $set: { isActive: false } }).exec();

      await request(server).get(`${CUSTOMER}/me`).set(as(accessToken)).expect(401);
    });
  });

  describe('separacao entre loja e painel', () => {
    it('token de cliente recebe 403 em rota do painel', async () => {
      const { accessToken } = await signUp();

      for (const route of [
        `${API}/admin/orders`,
        `${API}/admin/products`,
        `${API}/admin/categories`,
        `${API}/admin/settings`,
        `${API}/admin/delivery-cities`,
        `${API}/admin/payment-settings`,
        // Nao esta sob `/admin` e e do painel do mesmo jeito: o que decide nao
        // e o prefixo da URL, e a credencial que a rota exige.
        `${API}/users`,
      ]) {
        const { body } = await request(server).get(route).set(as(accessToken)).expect(403);

        expect(body.message).toContain('painel');
      }
    });

    it('token do painel nao abre a conta da loja', async () => {
      // Segredo diferente: o token do painel nem chega a ser reconhecido aqui.
      await request(server).get(`${CUSTOMER}/me`).set(as(await adminToken())).expect(401);
    });

    it('sem token, a conta responde 401', async () => {
      await request(server).get(`${CUSTOMER}/me`).expect(401);
      await request(server).get(`${CUSTOMER}/orders`).expect(401);
    });
  });

  describe('perfil e enderecos', () => {
    it('devolve a conta com os enderecos', async () => {
      const { accessToken } = await signUp();
      const { body } = await request(server)
        .get(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .expect(200);

      expect(body.name).toBe('Maria Silva');
      expect(body.addresses).toEqual([]);
    });

    it('salva endereco vinculado a cidade atendida', async () => {
      const { accessToken } = await signUp();
      const { body } = await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({
          addresses: [
            {
              label: 'Casa',
              cityId: seeded.cityId,
              street: 'Rua das Flores',
              number: '123',
              district: 'Centro',
              zipCode: '62000000',
            },
          ],
        })
        .expect(200);

      expect(body.addresses).toHaveLength(1);
      expect(body.addresses[0].cityId).toBe(seeded.cityId);
      expect(body.addresses[0].label).toBe('Casa');
      // CEP normalizado, e o primeiro endereco vira o padrao sozinho.
      expect(body.addresses[0].zipCode).toBe('62000-000');
      expect(body.addresses[0].isDefault).toBe(true);
    });

    it('recusa endereco em cidade que a loja nao atende', async () => {
      const { accessToken } = await signUp();

      await cities.updateOne({ _id: seeded.cityId }, { $set: { isActive: false } }).exec();

      await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({
          addresses: [
            { cityId: seeded.cityId, street: 'Rua das Flores', district: 'Centro' },
          ],
        })
        .expect(409);
    });

    it('editar o endereco mantem o mesmo id', async () => {
      const { accessToken } = await signUp();
      const salvo = await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ addresses: [{ street: 'Rua das Flores', district: 'Centro' }] })
        .expect(200);
      const id = salvo.body.addresses[0].id;

      const editado = await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ addresses: [{ id, street: 'Rua das Flores', number: '456', district: 'Centro' }] })
        .expect(200);

      expect(editado.body.addresses[0].id).toBe(id);
      expect(editado.body.addresses[0].number).toBe('456');
    });

    it('muda o nome sem apagar os enderecos', async () => {
      const { accessToken } = await signUp();

      await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ addresses: [{ street: 'Rua das Flores', district: 'Centro' }] })
        .expect(200);

      const { body } = await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ name: 'Maria S. Lima' })
        .expect(200);

      expect(body.name).toBe('Maria S. Lima');
      expect(body.addresses).toHaveLength(1);
    });

    it('nao aceita trocar o telefone por aqui', async () => {
      const { accessToken } = await signUp();

      // O telefone e a chave que liga a conta aos pedidos: trocar e conversa
      // com a loja, nao campo de formulario.
      await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ phone: '(88) 97777-0000' })
        .expect(400);
    });
  });

  describe('checkout e historico', () => {
    it('o checkout como convidado funciona do inicio ao fim', async () => {
      const { orderId } = await placeOrder();
      const saved = await orders.findById(orderId).exec();

      expect(saved?.customerId).toBeNull();
      expect(saved?.customer.phone).toBe(PHONE_STORED);
    });

    it('pedido feito com sessao ja nasce ligado a conta', async () => {
      const { accessToken, customerId } = await signUp();
      const { orderId } = await placeOrder(accessToken);
      const saved = await orders.findById(orderId).exec();

      expect(saved?.customerId?.toHexString()).toBe(customerId);
    });

    /** O primeiro criterio de aceite. */
    it('um pedido feito como convidado aparece na conta criada depois', async () => {
      const { code } = await placeOrder();

      const { accessToken } = await signUp();
      const { body: historico } = await request(server)
        .get(`${CUSTOMER}/orders`)
        .set(as(accessToken))
        .expect(200);

      expect(historico.totalItems).toBe(1);
      expect(historico.items[0].code).toBe(code);

      const { body: pedido } = await request(server)
        .get(`${CUSTOMER}/orders/${code}`)
        .set(as(accessToken))
        .expect(200);

      expect(pedido.totals.totalCents).toBe(PRICE + CITY_FEE);
    });

    it('o pedido feito deslogado depois do cadastro entra no proximo login', async () => {
      await signUp();
      const { code } = await placeOrder();

      const { body: sessao } = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: PASSWORD })
        .expect(200);
      const { body: historico } = await request(server)
        .get(`${CUSTOMER}/orders`)
        .set(as(sessao.accessToken))
        .expect(200);

      expect(historico.items[0].code).toBe(code);
    });

    it('nao adota pedido de outro telefone', async () => {
      await placeOrder(undefined, '(88) 97777-5555');

      const { accessToken } = await signUp();
      const { body } = await request(server)
        .get(`${CUSTOMER}/orders`)
        .set(as(accessToken))
        .expect(200);

      expect(body.totalItems).toBe(0);
    });

    it('nao devolve o pedido de outra conta, nem pelo codigo', async () => {
      const { code } = await placeOrder();

      await signUp();

      const outra = await request(server)
        .post(`${CUSTOMER}/register`)
        .send(
          registration({
            phone: '(88) 96666-7777',
            email: 'outra@exemplo.com',
          }),
        )
        .expect(201);

      // O codigo existe, mas nao e dela: 404, e nao 403 — dizer "existe, mas
      // nao e seu" ja seria contar demais.
      await request(server)
        .get(`${CUSTOMER}/orders/${code}`)
        .set(as(outra.body.accessToken))
        .expect(404);
    });

    it('o historico nao mostra a anotacao interna da loja', async () => {
      const { code, orderId } = await placeOrder();

      await orders.updateOne({ _id: orderId }, { $set: { notes: 'cliente exigente' } }).exec();

      const { accessToken } = await signUp();
      const { body } = await request(server)
        .get(`${CUSTOMER}/orders/${code}`)
        .set(as(accessToken))
        .expect(200);

      expect(body.notes).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('exigente');
    });

    it('o checkout ignora um token vencido e segue como convidado', async () => {
      const { orderId } = await placeOrder('token.invalido.qualquer');
      const saved = await orders.findById(orderId).exec();

      // Nada no checkout pode depender de a sessao estar boa.
      expect(saved?.customerId).toBeNull();
    });
  });

  /* ---- Trocar a senha estando dentro ------------------------------------ */

  describe('PATCH /customer/me/password', () => {
    it('troca a senha, derruba as outras sessoes e devolve uma nova', async () => {
      const primeira = await signUp();
      // Uma segunda sessao, como quem entrou tambem no computador da loja.
      const { body: segunda } = await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: PASSWORD })
        .expect(200);

      const { body: trocada } = await request(server)
        .patch(`${CUSTOMER}/me/password`)
        .set(as(primeira.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'outra-senha-bem-longa' })
        .expect(200);

      // A sessao de quem trocou continua, com o par novo da resposta.
      await request(server)
        .get(`${CUSTOMER}/me`)
        .set(as(trocada.accessToken))
        .expect(200);

      // A outra morre: e o proposito de trocar senha.
      await request(server).get(`${CUSTOMER}/me`).set(as(segunda.accessToken)).expect(401);
      await request(server)
        .post(`${CUSTOMER}/refresh`)
        .send({ refreshToken: segunda.refreshToken })
        .expect(401);

      // A senha velha nao entra mais; a nova entra.
      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: PASSWORD })
        .expect(401);
      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: 'outra-senha-bem-longa' })
        .expect(200);
    });

    it('recusa a senha atual errada sem mexer em nada', async () => {
      const { accessToken } = await signUp();

      await request(server)
        .patch(`${CUSTOMER}/me/password`)
        .set(as(accessToken))
        .send({ currentPassword: 'nao-e-essa', newPassword: 'outra-senha-bem-longa' })
        .expect(401);

      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: PASSWORD })
        .expect(200);
    });

    it('recusa senha curta e senha igual a atual', async () => {
      const { accessToken } = await signUp();

      await request(server)
        .patch(`${CUSTOMER}/me/password`)
        .set(as(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'curta' })
        .expect(400);

      await request(server)
        .patch(`${CUSTOMER}/me/password`)
        .set(as(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
        .expect(400);
    });

    it('sem sessao nao chega na rota', async () => {
      await request(server)
        .patch(`${CUSTOMER}/me/password`)
        .send({ currentPassword: PASSWORD, newPassword: 'outra-senha-bem-longa' })
        .expect(401);
    });
  });

  /* ---- Trocar o e-mail, que agora abre a conta -------------------------- */

  describe('o e-mail virou credencial', () => {
    it('trocar o e-mail sem confirmar a senha e recusado', async () => {
      const { accessToken } = await signUp();

      await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ email: 'outro@exemplo.com' })
        .expect(400);

      const guardada = await customers.findOne({}).exec();

      expect(guardada?.email).toBe('maria@exemplo.com');
    });

    it('com a senha certa, troca — e o login segue o e-mail novo', async () => {
      const { accessToken } = await signUp();

      await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ email: 'outro@exemplo.com', currentPassword: PASSWORD })
        .expect(200);

      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: 'outro@exemplo.com', password: PASSWORD })
        .expect(200);
      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: 'maria@exemplo.com', password: PASSWORD })
        .expect(401);
    });

    it('corrigir so o nome continua sem pedir senha', async () => {
      const { accessToken } = await signUp();

      const { body } = await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ name: 'Maria Silva Souza' })
        .expect(200);

      expect(body.name).toBe('Maria Silva Souza');
    });

    it('mandar o mesmo e-mail que ja esta gravado nao pede senha', async () => {
      const { accessToken } = await signUp();

      // A tela manda o formulario inteiro: o e-mail vem junto sem ter mudado.
      await request(server)
        .patch(`${CUSTOMER}/me`)
        .set(as(accessToken))
        .send({ name: 'Maria S.', email: 'maria@exemplo.com' })
        .expect(200);
    });
  });

  /* ---- Esqueci minha senha ---------------------------------------------- */

  describe('recuperacao de senha', () => {
    /** O token que foi no e-mail, lido do link da mensagem interceptada. */
    function tokenFromMail(): string {
      const link = /token=([0-9a-f]{64})/.exec(sent.at(-1)?.text ?? '');

      expect(link).not.toBeNull();

      return link?.[1] ?? '';
    }

    async function forgot(identifier: string): Promise<void> {
      await request(server)
        .post(`${CUSTOMER}/password/forgot`)
        .send({ identifier })
        .expect(200);
    }

    it('manda o link para o e-mail da conta e a senha nova entra', async () => {
      await signUp();

      await forgot(PHONE_TYPED);

      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('maria@exemplo.com');

      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token: tokenFromMail(), password: 'senha-nova-bem-longa' })
        .expect(204);

      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: 'senha-nova-bem-longa' })
        .expect(200);
      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: PASSWORD })
        .expect(401);
    });

    it('pedir pelo e-mail funciona igual', async () => {
      await signUp();

      await forgot('maria@exemplo.com');

      expect(sent).toHaveLength(1);
    });

    it('conta que nao existe responde a mesma coisa, sem mandar nada', async () => {
      await signUp();

      const existe = await request(server)
        .post(`${CUSTOMER}/password/forgot`)
        .send({ identifier: PHONE_TYPED })
        .expect(200);
      const naoExiste = await request(server)
        .post(`${CUSTOMER}/password/forgot`)
        .send({ identifier: '(88) 97777-0000' })
        .expect(200);

      expect(naoExiste.body.message).toBe(existe.body.message);
      // Uma mensagem so: a do telefone que tem conta.
      expect(sent).toHaveLength(1);
    });

    it('derruba todas as sessoes abertas', async () => {
      const { accessToken, refreshToken } = await signUp();

      await forgot(PHONE_TYPED);
      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token: tokenFromMail(), password: 'senha-nova-bem-longa' })
        .expect(204);

      await request(server).get(`${CUSTOMER}/me`).set(as(accessToken)).expect(401);
      await request(server).post(`${CUSTOMER}/refresh`).send({ refreshToken }).expect(401);
    });

    it('o link so funciona uma vez', async () => {
      await signUp();

      await forgot(PHONE_TYPED);
      const token = tokenFromMail();

      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token, password: 'senha-nova-bem-longa' })
        .expect(204);
      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token, password: 'terceira-senha-longa' })
        .expect(400);

      // A segunda tentativa nao gravou nada por cima.
      await request(server)
        .post(`${CUSTOMER}/login`)
        .send({ identifier: PHONE_TYPED, password: 'senha-nova-bem-longa' })
        .expect(200);
    });

    it('pedir de novo encerra o link anterior', async () => {
      await signUp();

      await forgot(PHONE_TYPED);
      const primeiro = tokenFromMail();

      await forgot(PHONE_TYPED);
      const segundo = tokenFromMail();

      expect(segundo).not.toBe(primeiro);

      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token: primeiro, password: 'senha-nova-bem-longa' })
        .expect(400);
      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token: segundo, password: 'senha-nova-bem-longa' })
        .expect(204);
    });

    it('token vencido nao abre nada', async () => {
      await signUp();

      await forgot(PHONE_TYPED);
      const token = tokenFromMail();

      // O relogio nao se mexe: o vencimento e que anda para tras.
      await resets.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } }).exec();

      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token, password: 'senha-nova-bem-longa' })
        .expect(400);
    });

    it('token inventado responde igual a token vencido', async () => {
      await signUp();

      const inventado = await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token: 'a'.repeat(64), password: 'senha-nova-bem-longa' })
        .expect(400);

      expect(String(inventado.body.message)).toMatch(/não vale mais/);
    });

    it('o que nao tem cara de token morre na validacao, sem consultar nada', async () => {
      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token: 'nao-e-um-token', password: 'senha-nova-bem-longa' })
        .expect(400);
    });

    it('o token gravado e o hash, nunca o token', async () => {
      await signUp();

      await forgot(PHONE_TYPED);
      const token = tokenFromMail();

      // `+tokenHash`: o campo e `select: false`, como o da senha.
      const guardado = await resets.findOne({}).select('+tokenHash').exec();

      expect(guardado?.tokenHash).not.toBe(token);
      expect(guardado?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(guardado?.toJSON() ?? {})).not.toContain(token);
    });

    it('senha curta e recusada antes de o token ser gasto', async () => {
      await signUp();

      await forgot(PHONE_TYPED);
      const token = tokenFromMail();

      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token, password: 'curta' })
        .expect(400);

      // O link continua valendo: quem errou o tamanho tenta de novo.
      await request(server)
        .post(`${CUSTOMER}/password/reset`)
        .send({ token, password: 'senha-nova-bem-longa' })
        .expect(204);
    });
  });
});
