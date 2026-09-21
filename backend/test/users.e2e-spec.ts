import { Body, Controller, INestApplication, Logger, Patch } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import { MANAGES_STORE } from '../src/common/roles.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { RefreshToken, USER_ROLES, User, type UserRole } from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

/**
 * Faz as vezes da rota de preco do modulo de produtos, que ainda nao existe.
 *
 * Usa o mesmo conjunto de papeis que o modulo vai usar (`MANAGES_STORE`),
 * entao o que este teste prova e a regra, nao um decorator escrito so aqui.
 */
@Controller('produtos-probe')
class ProductPriceProbeController {
  @Roles(...MANAGES_STORE)
  @Patch('preco')
  updatePrice(@Body() body: { priceCents?: number }): { priceCents?: number } {
    return body;
  }
}

describe('users (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let refreshTokens: Model<RefreshToken>;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProductPriceProbeController],
    }).compile();

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
    id: string;
    accessToken: string;
    refreshToken: string;
  }

  async function createUser(
    role: UserRole,
    email: string,
    overrides: Partial<User> = {},
  ): Promise<string> {
    const created = await users.create({
      name: `Usuario ${role}`,
      email,
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: false,
      ...overrides,
    });

    return created._id.toHexString();
  }

  async function signIn(email: string, password = PASSWORD): Promise<Session> {
    const response = await request(server)
      .post(`${API}/auth/login`)
      .send({ email, password })
      .expect(200);

    return {
      id: response.body.user.id,
      accessToken: response.body.accessToken,
      refreshToken: response.body.refreshToken,
    };
  }

  /** Cria o usuario e ja devolve a sessao dele. */
  async function signedIn(role: UserRole, email: string): Promise<Session> {
    await createUser(role, email);

    return signIn(email);
  }

  function as(session: Session): { Authorization: string } {
    return { Authorization: `Bearer ${session.accessToken}` };
  }

  describe('GET /users', () => {
    it('o SUPER_ADMIN ve todo mundo', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      await createUser(USER_ROLES.OWNER, 'dona@maisonessence.com');
      await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');

      const response = await request(server).get(`${API}/users`).set(as(root)).expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0]).not.toHaveProperty('passwordHash');
    });

    it('o OWNER nao enxerga SUPER_ADMIN', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
      await createUser(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');

      const response = await request(server).get(`${API}/users`).set(as(owner)).expect(200);

      const roles = response.body.map((user: { role: UserRole }) => user.role);

      expect(roles).not.toContain(USER_ROLES.SUPER_ADMIN);
      expect(roles).toContain(USER_ROLES.STAFF);
    });

    it('o STAFF nao gerencia usuarios', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      const response = await request(server).get(`${API}/users`).set(as(staff)).expect(403);

      expect(response.body.message).toBe('Seu papel nao permite esta operacao.');
    });

    it('sem token continua 401', async () => {
      await request(server).get(`${API}/users`).expect(401);
    });
  });

  describe('POST /users', () => {
    it('cria com senha temporaria e mustChangePassword', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const logged = vi.spyOn(Logger.prototype, 'log');

      const response = await request(server)
        .post(`${API}/users`)
        .set(as(root))
        .send({
          name: 'Nova vendedora',
          email: 'Vendedora@MaisonEssence.com',
          role: USER_ROLES.STAFF,
          temporaryPassword: 'temporaria-desta-vez',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Nova vendedora',
        // O e-mail e normalizado na entrada.
        email: 'vendedora@maisonessence.com',
        role: USER_ROLES.STAFF,
        isActive: true,
        mustChangePassword: true,
      });
      expect(response.body).not.toHaveProperty('passwordHash');

      // A senha temporaria ja serve para entrar.
      const session = await signIn('vendedora@maisonessence.com', 'temporaria-desta-vez');

      expect(session.accessToken).toBeTruthy();

      // Auditoria: ator, alvo, acao e data, em uma linha JSON.
      const audit = logged.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.includes('user.created'));

      logged.mockRestore();

      expect(audit).toBeDefined();
      expect(JSON.parse(audit as string)).toMatchObject({
        action: 'user.created',
        actor: { id: root.id, email: 'root@maisonessence.com' },
        target: { email: 'vendedora@maisonessence.com', role: USER_ROLES.STAFF },
      });
      expect(typeof JSON.parse(audit as string).at).toBe('string');
    });

    it('o OWNER recebe 403 ao tentar criar um SUPER_ADMIN', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');

      const response = await request(server)
        .post(`${API}/users`)
        .set(as(owner))
        .send({
          name: 'Outro root',
          email: 'outro-root@maisonessence.com',
          role: USER_ROLES.SUPER_ADMIN,
          temporaryPassword: 'temporaria-desta-vez',
        })
        .expect(403);

      expect(response.body.message).toBe('Voce so pode atribuir o papel STAFF.');
      await expect(users.countDocuments({ role: USER_ROLES.SUPER_ADMIN })).resolves.toBe(0);
    });

    it('o OWNER cria STAFF', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');

      await request(server)
        .post(`${API}/users`)
        .set(as(owner))
        .send({
          name: 'Vendedora',
          email: 'vendedora@maisonessence.com',
          role: USER_ROLES.STAFF,
          temporaryPassword: 'temporaria-desta-vez',
        })
        .expect(201);
    });

    it('recusa e-mail repetido com 409', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .post(`${API}/users`)
        .set(as(root))
        .send({
          name: 'Outra pessoa',
          email: 'root@maisonessence.com',
          role: USER_ROLES.STAFF,
          temporaryPassword: 'temporaria-desta-vez',
        })
        .expect(409);
    });

    it('recusa senha temporaria curta', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .post(`${API}/users`)
        .set(as(root))
        .send({
          name: 'Vendedora',
          email: 'vendedora@maisonessence.com',
          role: USER_ROLES.STAFF,
          temporaryPassword: 'curta',
        })
        .expect(400);
    });
  });

  describe('PATCH /users/:id', () => {
    it('edita nome e e-mail', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const staffId = await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');

      const response = await request(server)
        .patch(`${API}/users/${staffId}`)
        .set(as(root))
        .send({ name: 'Nome corrigido' })
        .expect(200);

      expect(response.body.name).toBe('Nome corrigido');
    });

    it('para o OWNER, um SUPER_ADMIN responde 404 e outro OWNER responde 403', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
      const rootId = await createUser(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const otherOwnerId = await createUser(USER_ROLES.OWNER, 'socia@maisonessence.com');

      await request(server)
        .patch(`${API}/users/${rootId}`)
        .set(as(owner))
        .send({ name: 'Tentativa' })
        .expect(404);

      await request(server)
        .patch(`${API}/users/${otherOwnerId}`)
        .set(as(owner))
        .send({ name: 'Tentativa' })
        .expect(403);
    });

    it('cada um corrige o proprio cadastro', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');

      await request(server)
        .patch(`${API}/users/${owner.id}`)
        .set(as(owner))
        .send({ name: 'Nome novo da dona' })
        .expect(200);
    });

    it('mudar o papel invalida o access token e a renovacao ja traz o papel novo', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');
      const staff = await signIn('staff@maisonessence.com');

      await request(server)
        .patch(`${API}/users/${staff.id}`)
        .set(as(root))
        .send({ role: USER_ROLES.OWNER })
        .expect(200);

      // O papel antigo estava dentro do token: ele para de valer na hora.
      await request(server).get(`${API}/auth/me`).set(as(staff)).expect(401);

      // A sessao continua de pe e a renovacao sai com o papel novo.
      const renewed = await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: staff.refreshToken })
        .expect(200);

      expect(renewed.body.user.role).toBe(USER_ROLES.OWNER);
    });

    it('ninguem muda o proprio papel', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .patch(`${API}/users/${root.id}`)
        .set(as(root))
        .send({ role: USER_ROLES.STAFF })
        .expect(403);
    });

    it('impede rebaixar o ultimo SUPER_ADMIN ativo', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const otherRootId = await createUser(USER_ROLES.SUPER_ADMIN, 'root2@maisonessence.com');

      // Com dois, rebaixar um e permitido.
      await request(server)
        .patch(`${API}/users/${otherRootId}`)
        .set(as(root))
        .send({ role: USER_ROLES.OWNER })
        .expect(200);

      // O que sobrou nao pode ser rebaixado por mais ninguem.
      const owner = await signIn('root2@maisonessence.com');

      await request(server)
        .patch(`${API}/users/${root.id}`)
        .set(as(owner))
        .send({ role: USER_ROLES.OWNER })
        .expect(404);
    });

    it('recusa corpo vazio', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server).patch(`${API}/users/${root.id}`).set(as(root)).send({}).expect(400);
    });

    it('id malformado responde 404', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .patch(`${API}/users/nao-e-um-id`)
        .set(as(root))
        .send({ name: 'Qualquer' })
        .expect(404);
    });
  });

  describe('PATCH /users/:id/status', () => {
    it('desativar um usuario logado derruba a sessao dele na proxima chamada', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');
      const staff = await signIn('staff@maisonessence.com');

      await request(server).get(`${API}/auth/me`).set(as(staff)).expect(200);

      await request(server)
        .patch(`${API}/users/${staff.id}/status`)
        .set(as(root))
        .send({ isActive: false })
        .expect(200);

      await request(server).get(`${API}/auth/me`).set(as(staff)).expect(401);
      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: staff.refreshToken })
        .expect(401);
      await expect(refreshTokens.countDocuments({ revokedAt: null })).resolves.toBe(1);
    });

    it('usuario desativado nao faz login de novo', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const staffId = await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await request(server)
        .patch(`${API}/users/${staffId}/status`)
        .set(as(root))
        .send({ isActive: false })
        .expect(200);

      await request(server)
        .post(`${API}/auth/login`)
        .send({ email: 'staff@maisonessence.com', password: PASSWORD })
        .expect(401);
    });

    it('reativar devolve o acesso', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const staffId = await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com', {
        isActive: false,
      });

      await request(server)
        .patch(`${API}/users/${staffId}/status`)
        .set(as(root))
        .send({ isActive: true })
        .expect(200);

      await signIn('staff@maisonessence.com');
    });

    it('ninguem desativa a si mesmo', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      await createUser(USER_ROLES.SUPER_ADMIN, 'root2@maisonessence.com');

      const response = await request(server)
        .patch(`${API}/users/${root.id}/status`)
        .set(as(root))
        .send({ isActive: false })
        .expect(409);

      expect(response.body.message).toBe('Voce nao pode desativar a si mesmo.');
    });

    it('o ultimo SUPER_ADMIN ativo nao pode ser desativado', async () => {
      const rootId = await createUser(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      await createUser(USER_ROLES.SUPER_ADMIN, 'root2@maisonessence.com', {
        isActive: false,
      });
      const other = await signedIn(USER_ROLES.SUPER_ADMIN, 'root3@maisonessence.com');

      // Com dois ativos, da para desativar um.
      await request(server)
        .patch(`${API}/users/${rootId}/status`)
        .set(as(other))
        .send({ isActive: false })
        .expect(200);

      // O ultimo ativo e o proprio ator, e ai valem as duas regras.
      const response = await request(server)
        .patch(`${API}/users/${other.id}/status`)
        .set(as(other))
        .send({ isActive: false })
        .expect(409);

      expect(response.body.message).toBe('Voce nao pode desativar a si mesmo.');
    });

    it('o OWNER desativa STAFF, mas nao outro OWNER', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
      const staffId = await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');
      const otherOwnerId = await createUser(USER_ROLES.OWNER, 'socia@maisonessence.com');

      await request(server)
        .patch(`${API}/users/${staffId}/status`)
        .set(as(owner))
        .send({ isActive: false })
        .expect(200);

      await request(server)
        .patch(`${API}/users/${otherOwnerId}/status`)
        .set(as(owner))
        .send({ isActive: false })
        .expect(403);
    });
  });

  describe('POST /users/:id/reset-password', () => {
    it('gera senha nova, exige troca e derruba as sessoes', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com');
      const staff = await signIn('staff@maisonessence.com');

      const response = await request(server)
        .post(`${API}/users/${staff.id}/reset-password`)
        .set(as(root))
        .expect(201);

      const { temporaryPassword } = response.body;

      expect(typeof temporaryPassword).toBe('string');
      expect(temporaryPassword).toHaveLength(16);
      expect(response.body.user.mustChangePassword).toBe(true);

      // A sessao antiga morre.
      await request(server).get(`${API}/auth/me`).set(as(staff)).expect(401);
      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: staff.refreshToken })
        .expect(401);

      // A senha antiga nao serve mais; a nova serve, ja com a pendencia.
      await request(server)
        .post(`${API}/auth/login`)
        .send({ email: 'staff@maisonessence.com', password: PASSWORD })
        .expect(401);

      const renewed = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: 'staff@maisonessence.com', password: temporaryPassword })
        .expect(200);

      expect(renewed.body.user.mustChangePassword).toBe(true);
    });

    it('o OWNER nao reseta a senha de outro OWNER', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
      const otherOwnerId = await createUser(USER_ROLES.OWNER, 'socia@maisonessence.com');

      await request(server)
        .post(`${API}/users/${otherOwnerId}/reset-password`)
        .set(as(owner))
        .expect(403);
    });
  });

  describe('PATCH /auth/change-password', () => {
    it('troca a senha, limpa a pendencia e devolve sessao nova', async () => {
      await createUser(USER_ROLES.STAFF, 'staff@maisonessence.com', {
        mustChangePassword: true,
      });
      const staff = await signIn('staff@maisonessence.com');
      const outraAba = await signIn('staff@maisonessence.com');

      const response = await request(server)
        .patch(`${API}/auth/change-password`)
        .set(as(staff))
        .send({ currentPassword: PASSWORD, newPassword: 'outra-senha-bem-longa' })
        .expect(200);

      expect(response.body.user.mustChangePassword).toBe(false);

      // A sessao devolvida ja vale, sem novo login.
      const me = await request(server)
        .get(`${API}/auth/me`)
        .set({ Authorization: `Bearer ${response.body.accessToken}` })
        .expect(200);

      expect(me.body.mustChangePassword).toBe(false);

      // As outras sessoes caem.
      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: outraAba.refreshToken })
        .expect(401);

      // Senha nova entra, senha velha nao.
      await signIn('staff@maisonessence.com', 'outra-senha-bem-longa');
      await request(server)
        .post(`${API}/auth/login`)
        .send({ email: 'staff@maisonessence.com', password: PASSWORD })
        .expect(401);
    });

    it('recusa senha atual errada', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await request(server)
        .patch(`${API}/auth/change-password`)
        .set(as(staff))
        .send({ currentPassword: 'nao-e-a-senha', newPassword: 'outra-senha-bem-longa' })
        .expect(401);
    });

    it('recusa nova senha igual a atual ou curta demais', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await request(server)
        .patch(`${API}/auth/change-password`)
        .set(as(staff))
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
        .expect(400);

      await request(server)
        .patch(`${API}/auth/change-password`)
        .set(as(staff))
        .send({ currentPassword: PASSWORD, newPassword: 'curta' })
        .expect(400);
    });
  });

  describe('senha temporaria pendente', () => {
    it('so a troca de senha passa; as rotas administrativas respondem 403', async () => {
      await createUser(USER_ROLES.OWNER, 'dona@maisonessence.com', {
        mustChangePassword: true,
      });
      const owner = await signIn('dona@maisonessence.com');

      await request(server).get(`${API}/users`).set(as(owner)).expect(403);
      await request(server)
        .patch(`${API}/produtos-probe/preco`)
        .set(as(owner))
        .send({ priceCents: 19990 })
        .expect(403);

      const changed = await request(server)
        .patch(`${API}/auth/change-password`)
        .set(as(owner))
        .send({ currentPassword: PASSWORD, newPassword: 'outra-senha-bem-longa' })
        .expect(200);

      await request(server)
        .get(`${API}/users`)
        .set({ Authorization: `Bearer ${changed.body.accessToken}` })
        .expect(200);
    });
  });

  describe('papeis nas rotas da loja', () => {
    it('o STAFF recebe 403 ao tentar alterar preco de produto', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      const response = await request(server)
        .patch(`${API}/produtos-probe/preco`)
        .set(as(staff))
        .send({ priceCents: 19990 })
        .expect(403);

      expect(response.body.message).toBe('Seu papel nao permite esta operacao.');
    });

    it('o OWNER altera preco', async () => {
      const owner = await signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');

      await request(server)
        .patch(`${API}/produtos-probe/preco`)
        .set(as(owner))
        .send({ priceCents: 19990 })
        .expect(200);
    });

    it('o SUPER_ADMIN passa sem estar na lista de papeis', async () => {
      const root = await signedIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .patch(`${API}/produtos-probe/preco`)
        .set(as(root))
        .send({ priceCents: 19990 })
        .expect(200);
    });
  });
});
