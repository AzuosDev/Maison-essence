import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { RefreshToken, USER_ROLES, User, type UserRole } from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

interface CollectionCount {
  name: string;
  count: number;
}

describe('sistema (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let refreshTokens: Model<RefreshToken>;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    refreshTokens = app.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));
    passwordHash = await app.get(PasswordService).hash(PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await Promise.all([users.deleteMany({}), refreshTokens.deleteMany({})]);
  });

  interface Session {
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

    return { accessToken: response.body.accessToken };
  }

  function as(session: Session): { Authorization: string } {
    return { Authorization: `Bearer ${session.accessToken}` };
  }

  function countOf(body: CollectionCount[], name: string): number | undefined {
    return body.find((collection) => collection.name === name)?.count;
  }

  describe('GET /admin/system/collections', () => {
    it('conta os documentos de cada colecao registrada', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      const response = await request(server)
        .get(`${API}/admin/system/collections`)
        .set(as(root))
        .expect(200);

      const body = response.body as CollectionCount[];

      // O proprio SUPER_ADMIN do teste e o login que ele acabou de fazer.
      expect(countOf(body, 'users')).toBe(1);
      expect(countOf(body, 'refresh_tokens')).toBe(1);
    });

    it('colecao registrada e ainda vazia aparece com zero', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      const response = await request(server)
        .get(`${API}/admin/system/collections`)
        .set(as(root))
        .expect(200);

      // Nenhum pedido foi criado: a colecao nem existe no Mongo, e a resposta
      // certa para a tela continua sendo zero, e nao a ausencia da linha.
      expect(countOf(response.body, 'orders')).toBe(0);
    });

    it('cada colecao sai uma vez so, em ordem alfabetica', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      const response = await request(server)
        .get(`${API}/admin/system/collections`)
        .set(as(root))
        .expect(200);

      const names = (response.body as CollectionCount[]).map((collection) => collection.name);

      expect(names).toEqual([...new Set(names)]);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    });

    it('o OWNER nao entra: o mapa interno e de quem mantem o sistema', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');

      await request(server)
        .get(`${API}/admin/system/collections`)
        .set(as(owner))
        .expect(403);
    });

    it('sem sessao responde 401', async () => {
      await request(server).get(`${API}/admin/system/collections`).expect(401);
    });
  });
});
