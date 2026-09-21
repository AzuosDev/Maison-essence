import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { DeliveryService } from '../src/modules/delivery/delivery.service.js';
import {
  DeliveryCity,
  FULFILLMENT_MODES,
  RefreshToken,
  StoreSettings,
  USER_ROLES,
  User,
  type UserRole,
} from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

describe('entrega (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let refreshTokens: Model<RefreshToken>;
  let settings: Model<StoreSettings>;
  let cities: Model<DeliveryCity>;
  let delivery: DeliveryService;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    refreshTokens = app.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));
    settings = app.get<Model<StoreSettings>>(getModelToken(StoreSettings.name));
    cities = app.get<Model<DeliveryCity>>(getModelToken(DeliveryCity.name));
    delivery = app.get(DeliveryService);
    passwordHash = await app.get(PasswordService).hash(PASSWORD);

    // `autoIndex` so vale em desenvolvimento (ver `database.module`), e a
    // recusa de cidade repetida depende do indice unico de nome e estado. Em
    // producao quem os cria e o seed, antes de qualquer gravacao.
    await cities.createIndexes();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await Promise.all([
      users.deleteMany({}),
      refreshTokens.deleteMany({}),
      settings.deleteMany({}),
      cities.deleteMany({}),
    ]);
  });

  interface Session {
    id: string;
    accessToken: string;
  }

  async function signedIn(role: UserRole, email: string): Promise<Session> {
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

    return { id: response.body.user.id, accessToken: response.body.accessToken };
  }

  function as(session: Session): { Authorization: string } {
    return { Authorization: `Bearer ${session.accessToken}` };
  }

  function signedInOwner(): Promise<Session> {
    return signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
  }

  function listCities(session: Session): request.Test {
    return request(server).get(`${API}/admin/delivery-cities`).set(as(session));
  }

  function createCity(session: Session, body: Record<string, unknown>): request.Test {
    return request(server).post(`${API}/admin/delivery-cities`).set(as(session)).send(body);
  }

  function patchCity(
    session: Session,
    id: string,
    body: Record<string, unknown>,
  ): request.Test {
    return request(server).patch(`${API}/admin/delivery-cities/${id}`).set(as(session)).send(body);
  }

  function publicCities(): request.Test {
    return request(server).get(`${API}/delivery-cities`);
  }

  /** Configuracao da loja pela rota que a dona usa, e nao por escrita direta. */
  function patchSettings(session: Session, body: Record<string, unknown>): request.Test {
    return request(server).patch(`${API}/admin/settings`).set(as(session)).send(body);
  }

  /** Sobral: cidade da loja, taxa baixa e regra propria de frete gratis. */
  async function sobral(
    session: Session,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await createCity(session, {
      name: 'Sobral',
      state: 'CE',
      feeCents: 1000,
      estimatedDays: 1,
      minOrderForFreeCents: 15_000,
      order: 0,
      ...overrides,
    }).expect(201);

    return response.body.id;
  }

  /** Fortaleza: sem regra propria, portanto sob a regra global da loja. */
  async function fortaleza(
    session: Session,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await createCity(session, {
      name: 'Fortaleza',
      state: 'CE',
      feeCents: 2500,
      estimatedDays: 3,
      order: 1,
      ...overrides,
    }).expect(201);

    return response.body.id;
  }

  describe('GET /admin/delivery-cities', () => {
    it('recusa quem nao esta autenticado', async () => {
      await request(server).get(`${API}/admin/delivery-cities`).expect(401);
    });

    it('recusa o STAFF: tabela de taxa e preco, e preco e da dona', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await listCities(staff).expect(403);
    });

    it('lista ativas e inativas, na ordem escolhida', async () => {
      const owner = await signedInOwner();

      await fortaleza(owner);
      await sobral(owner);
      await createCity(owner, {
        name: 'Camocim',
        state: 'CE',
        feeCents: 3500,
        isActive: false,
        order: 2,
      }).expect(201);

      const response = await listCities(owner).expect(200);

      // A desativada continua na lista do painel: e de la que a dona a
      // reativa quando volta a atender.
      expect(response.body.map((city: { name: string }) => city.name)).toEqual([
        'Sobral',
        'Fortaleza',
        'Camocim',
      ]);
    });
  });

  describe('POST /admin/delivery-cities', () => {
    it('cadastra com os padroes de quem nao informou tudo', async () => {
      const owner = await signedInOwner();

      const response = await createCity(owner, {
        name: 'Sobral',
        state: 'ce',
        feeCents: 1000,
      }).expect(201);

      expect(response.body).toMatchObject({
        name: 'Sobral',
        // Sigla em maiuscula: a dona digita como quer, o banco guarda como o
        // resto do sistema espera ler.
        state: 'CE',
        feeCents: 1000,
        estimatedDays: 1,
        minOrderForFreeCents: null,
        isActive: true,
        order: 0,
      });
    });

    it('recusa a mesma cidade duas vezes', async () => {
      const owner = await signedInOwner();

      await sobral(owner);

      // Duas Sobral seriam duas taxas para o mesmo endereco, e o checkout
      // mostraria a que a consulta trouxesse primeiro.
      const response = await createCity(owner, {
        name: 'Sobral',
        state: 'CE',
        feeCents: 2000,
      }).expect(409);

      expect(String(response.body.message)).toMatch(/ja esta cadastrada/);
    });

    it('recusa taxa em reais', async () => {
      const owner = await signedInOwner();

      const response = await createCity(owner, {
        name: 'Sobral',
        state: 'CE',
        feeCents: 19.9,
      }).expect(400);

      expect(String(response.body.message)).toMatch(/centavos/);
    });

    it('recusa estado que nao e sigla', async () => {
      const owner = await signedInOwner();

      const response = await createCity(owner, {
        name: 'Sobral',
        state: 'Ceara',
        feeCents: 1000,
      }).expect(400);

      expect(String(response.body.message)).toMatch(/sigla de duas letras/);
    });

    it('recusa o STAFF', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await createCity(staff, { name: 'Sobral', state: 'CE', feeCents: 1000 }).expect(403);
    });
  });

  describe('PATCH /admin/delivery-cities/:id', () => {
    it('reajusta a taxa', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      const response = await patchCity(owner, id, { feeCents: 1200 }).expect(200);

      expect(response.body.feeCents).toBe(1200);
      // O que nao foi citado fica como estava.
      expect(response.body.minOrderForFreeCents).toBe(15_000);
    });

    it('null devolve a cidade a regra global', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      const response = await patchCity(owner, id, { minOrderForFreeCents: null }).expect(200);

      expect(response.body.minOrderForFreeCents).toBeNull();
    });

    it('desativa sem apagar', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      await patchCity(owner, id, { isActive: false }).expect(200);

      expect(await cities.countDocuments({})).toBe(1);
    });

    it('responde 404 para cidade que nao existe', async () => {
      const owner = await signedInOwner();

      const response = await patchCity(owner, '000000000000000000000000', {
        feeCents: 1000,
      }).expect(404);

      expect(String(response.body.message)).toMatch(/nao encontrada/);
    });

    it('trata id malformado como cidade inexistente', async () => {
      const owner = await signedInOwner();

      await patchCity(owner, 'cidade-de-sobral', { feeCents: 1000 }).expect(404);
    });
  });

  describe('PATCH /admin/delivery-cities/reorder', () => {
    function reorder(session: Session, ids: string[]): request.Test {
      return request(server)
        .patch(`${API}/admin/delivery-cities/reorder`)
        .set(as(session))
        .send({ ids });
    }

    it('grava a posicao pelo indice da lista recebida', async () => {
      const owner = await signedInOwner();
      const sobralId = await sobral(owner);
      const fortalezaId = await fortaleza(owner);

      const response = await reorder(owner, [fortalezaId, sobralId]).expect(200);

      expect(response.body.map((city: { name: string }) => city.name)).toEqual([
        'Fortaleza',
        'Sobral',
      ]);
      expect(response.body.map((city: { order: number }) => city.order)).toEqual([0, 1]);
    });

    it('recusa lista com cidade repetida', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      const response = await reorder(owner, [id, id]).expect(422);

      expect(String(response.body.message)).toMatch(/repetidas/);
    });

    it('recusa lista que cita cidade que nao existe', async () => {
      const owner = await signedInOwner();

      await sobral(owner);

      // Quase sempre e a tela aberta ha muito tempo, depois de outra pessoa
      // ter excluido a cidade: gravar assim ressuscitaria a ordem antiga.
      const response = await reorder(owner, ['000000000000000000000000']).expect(422);

      expect(String(response.body.message)).toMatch(/nao existe/);
    });
  });

  describe('DELETE /admin/delivery-cities/:id', () => {
    it('exclui e some da lista', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      await request(server)
        .delete(`${API}/admin/delivery-cities/${id}`)
        .set(as(owner))
        .expect(204);

      expect((await listCities(owner).expect(200)).body).toEqual([]);
    });

    it('responde 404 para cidade que nao existe', async () => {
      const owner = await signedInOwner();

      await request(server)
        .delete(`${API}/admin/delivery-cities/000000000000000000000000`)
        .set(as(owner))
        .expect(404);
    });
  });

  describe('GET /delivery-cities (publica)', () => {
    it('nao exige autenticacao e entrega so as ativas, ordenadas', async () => {
      const owner = await signedInOwner();

      await fortaleza(owner);
      await sobral(owner);
      await createCity(owner, {
        name: 'Camocim',
        state: 'CE',
        feeCents: 3500,
        isActive: false,
        order: 2,
      }).expect(201);

      const response = await publicCities().expect(200);

      expect(response.body.map((city: { name: string }) => city.name)).toEqual([
        'Sobral',
        'Fortaleza',
      ]);
    });

    it('escreve a taxa e o prazo do jeito que a tela exibe', async () => {
      const owner = await signedInOwner();

      await sobral(owner);
      await fortaleza(owner);

      const [primeira, segunda] = (await publicCities().expect(200)).body;

      expect(primeira).toMatchObject({
        name: 'Sobral',
        feeCents: 1000,
        feeLabel: 'R$ 10,00',
        estimatedDays: 1,
        estimatedLabel: 'Ate 1 dia util',
        freeFromCents: 15_000,
        freeFromLabel: 'Frete gratis a partir de R$ 150,00',
      });
      expect(segunda).toMatchObject({
        feeLabel: 'R$ 25,00',
        estimatedLabel: 'Ate 3 dias uteis',
        // Sem regra propria e sem regra global: nao ha frete gratis a anunciar.
        freeFromCents: null,
        freeFromLabel: '',
      });
    });

    it('cidade sem regra propria herda o minimo global da loja', async () => {
      const owner = await signedInOwner();

      await fortaleza(owner);
      await patchSettings(owner, { freeShippingMinCents: 25_000 }).expect(200);

      const [city] = (await publicCities().expect(200)).body;

      expect(city.freeFromCents).toBe(25_000);
      expect(city.freeFromLabel).toBe('Frete gratis a partir de R$ 250,00');
    });

    it('escreve Gratis onde a taxa cadastrada e zero', async () => {
      const owner = await signedInOwner();

      await sobral(owner, { feeCents: 0 });

      expect((await publicCities().expect(200)).body[0].feeLabel).toBe('Gratis');
    });

    it('pede cache na borda e responde 304 na revalidacao', async () => {
      const owner = await signedInOwner();

      await sobral(owner);

      const primeira = await publicCities().expect(200);

      expect(primeira.headers['cache-control']).toBe(
        'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      );

      const revalidacao = await publicCities()
        .set('If-None-Match', primeira.headers.etag)
        .expect(304);

      expect(revalidacao.body).toEqual({});
    });

    it('mexer no minimo global muda o ETag da lista de cidades', async () => {
      const owner = await signedInOwner();

      await fortaleza(owner);

      const antes = await publicCities().expect(200);

      // A cidade nao mudou; a regra que decide o rotulo dela, sim. Se o ETag
      // nao acompanhasse, a borda continuaria servindo a lista sem a
      // promessa de frete gratis que a dona acabou de ligar.
      await patchSettings(owner, { freeShippingMinCents: 25_000 }).expect(200);

      const depois = await publicCities().set('If-None-Match', antes.headers.etag).expect(200);

      expect(depois.headers.etag).not.toBe(antes.headers.etag);
      expect(depois.body[0].freeFromCents).toBe(25_000);
    });
  });

  describe('DeliveryService.resolveFee', () => {
    /**
     * A taxa e pedida ao servico, e nao a uma rota: e assim que o modulo de
     * pedidos vai chega-la. O teste entra pelo mesmo lugar para provar a
     * regra no caminho que o sistema de fato usa.
     */
    it('cobra a taxa da cidade abaixo do minimo', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      const quote = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: id,
        subtotalCents: 12_000,
      });

      expect(quote.feeCents).toBe(1000);
      expect(quote.isFree).toBe(false);
      expect(quote.freeReason).toBe('');
      expect(quote.missingForFreeCents).toBe(3000);
    });

    /** Criterio de aceite: acima do minimo, taxa zero e motivo preenchido. */
    it('pedido acima do minimo sai com frete gratis e o motivo escrito', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      const quote = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: id,
        subtotalCents: 20_000,
      });

      expect(quote.feeCents).toBe(0);
      expect(quote.isFree).toBe(true);
      expect(quote.freeReason).toBe('Frete gratis para Sobral em pedidos a partir de R$ 150,00.');
    });

    /** Criterio de aceite: retirada zera a taxa e dispensa endereco. */
    it('retirada zera a taxa e dispensa endereco', async () => {
      const owner = await signedInOwner();

      await patchSettings(owner, { pickupEnabled: true }).expect(200);

      const quote = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.PICKUP,
        subtotalCents: 1000,
      });

      expect(quote.feeCents).toBe(0);
      expect(quote.isFree).toBe(true);
      expect(quote.freeReason).toBe('Retirada na loja: sem taxa de entrega.');
      expect(quote.requiresAddress).toBe(false);
      expect(quote.cityId).toBeNull();
    });

    it('recusa retirada quando a loja nao a oferece', async () => {
      await expect(
        delivery.resolveFee({ mode: FULFILLMENT_MODES.PICKUP, subtotalCents: 1000 }),
      ).rejects.toThrow(/retirada na loja esta desativada/i);
    });

    it('aplica a regra global onde a cidade nao tem a sua', async () => {
      const owner = await signedInOwner();
      const id = await fortaleza(owner);

      await patchSettings(owner, { freeShippingMinCents: 25_000 }).expect(200);

      const quote = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: id,
        subtotalCents: 30_000,
      });

      expect(quote.feeCents).toBe(0);
      expect(quote.freeReason).toBe('Frete gratis em pedidos a partir de R$ 250,00.');
    });

    it('a regra da cidade tem precedencia sobre a global', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      // A loja perdoa a partir de R$ 100; Sobral so a partir de R$ 150. Um
      // pedido de R$ 120 em Sobral paga frete: quem tem regra propria nao cai
      // na geral.
      await patchSettings(owner, { freeShippingMinCents: 10_000 }).expect(200);

      const quote = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: id,
        subtotalCents: 12_000,
      });

      expect(quote.isFree).toBe(false);
      expect(quote.feeCents).toBe(1000);
    });

    it('o minimo trocado no painel vale no pedido seguinte, sem redeploy', async () => {
      const owner = await signedInOwner();
      const id = await fortaleza(owner);

      await patchSettings(owner, { freeShippingMinCents: 25_000 }).expect(200);

      const antes = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: id,
        subtotalCents: 20_000,
      });

      await patchSettings(owner, { freeShippingMinCents: 15_000 }).expect(200);

      const depois = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: id,
        subtotalCents: 20_000,
      });

      expect(antes.isFree).toBe(false);
      expect(depois.isFree).toBe(true);
    });

    /**
     * A resposta traz o retrato que o pedido congela — nome, estado, prazo e
     * taxa. E por isso que um pedido antigo continua legivel depois de a
     * cidade ser desativada ou reajustada: ele nao guarda uma referencia que
     * amanha responde outra coisa.
     */
    it('devolve o que o pedido precisa congelar', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      const quote = await delivery.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: id,
        subtotalCents: 5000,
      });

      expect(quote).toMatchObject({
        cityId: id,
        cityName: 'Sobral',
        state: 'CE',
        estimatedDays: 1,
        feeCents: 1000,
        requiresAddress: true,
      });
    });

    it('recusa pedido novo para cidade desativada', async () => {
      const owner = await signedInOwner();
      const id = await sobral(owner);

      await patchCity(owner, id, { isActive: false }).expect(200);

      await expect(
        delivery.resolveFee({
          mode: FULFILLMENT_MODES.DELIVERY,
          cityId: id,
          subtotalCents: 5000,
        }),
      ).rejects.toThrow(/nao entregamos mais nessa cidade/i);
    });

    it('exige a cidade quando o modo e entrega', async () => {
      await expect(
        delivery.resolveFee({ mode: FULFILLMENT_MODES.DELIVERY, subtotalCents: 5000 }),
      ).rejects.toThrow(/escolha a cidade/i);
    });
  });
});
