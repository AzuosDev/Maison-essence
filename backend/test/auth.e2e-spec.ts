import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import type { Env } from '../src/config/env.schema.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../src/modules/auth/auth.cookies.js';
import { TOKEN_TYPES } from '../src/modules/auth/auth.types.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import {
  LoginAttempt,
  RefreshToken,
  USER_ROLES,
  User,
  type UserDocument,
} from '../src/schemas.js';

const EMAIL = 'dona@maisonessence.com';
const PASSWORD = 'senha-longa-da-dona-2026';
const API = '/api/v1';

/**
 * Rota administrativa qualquer, so para provar o padrao: um controller novo
 * nasce protegido pelos guards globais, sem precisar declarar nada.
 */
@Controller('admin-probe')
class AdminProbeController {
  @Get()
  read(): { ok: true } {
    return { ok: true };
  }
}

describe('auth (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let refreshTokens: Model<RefreshToken>;
  let loginAttempts: Model<LoginAttempt>;
  let jwt: JwtService;
  let accessSecret: string;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    refreshTokens = app.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));
    loginAttempts = app.get<Model<LoginAttempt>>(getModelToken(LoginAttempt.name));
    jwt = app.get(JwtService);

    const config = app.get<ConfigService<Env, true>>(ConfigService);

    accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    // Um hash so para toda a suite: argon2 e caro de proposito.
    passwordHash = await app.get(PasswordService).hash(PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await Promise.all([
      users.deleteMany({}),
      refreshTokens.deleteMany({}),
      loginAttempts.deleteMany({}),
    ]);
  });

  function createUser(overrides: Partial<User> = {}): Promise<UserDocument> {
    return users.create({
      name: 'Dona da loja',
      email: EMAIL,
      passwordHash,
      role: USER_ROLES.OWNER,
      isActive: true,
      mustChangePassword: false,
      ...overrides,
    });
  }

  function login(
    body: { email?: string; password?: string } = {},
    ip = '203.0.113.10',
  ): request.Test {
    return request(server)
      .post(`${API}/auth/login`)
      .set('X-Forwarded-For', ip)
      .set('User-Agent', 'vitest')
      .send({ email: EMAIL, password: PASSWORD, ...body });
  }

  function signExpiredAccessToken(user: UserDocument): Promise<string> {
    return jwt.signAsync(
      {
        sub: user._id.toHexString(),
        email: user.email,
        role: user.role,
        credentialVersion: user.credentialVersion,
        mustChangePassword: user.mustChangePassword,
        type: TOKEN_TYPES.ACCESS,
      },
      { secret: accessSecret, expiresIn: -30 },
    );
  }

  describe('POST /auth/login', () => {
    it('devolve access e refresh, e /auth/me responde com o usuario', async () => {
      await createUser();

      const response = await login().expect(200);

      expect(response.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { email: EMAIL, role: USER_ROLES.OWNER, mustChangePassword: false },
      });
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const me = await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);

      expect(me.body).toMatchObject({ email: EMAIL, role: USER_ROLES.OWNER });
      expect(me.body.id).toBe(response.body.user.id);
    });

    it('manda os tokens em cookie httpOnly, secure, sameSite none e path restrito', async () => {
      await createUser();

      const response = await login().expect(200);
      const access = rawCookie(response, ACCESS_TOKEN_COOKIE);
      const refresh = rawCookie(response, REFRESH_TOKEN_COOKIE);

      for (const cookie of [access, refresh]) {
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('SameSite=None');
      }

      expect(access).toContain('Path=/api/v1;');
      expect(refresh).toContain('Path=/api/v1/auth;');
    });

    it('autentica tambem pelo cookie, sem Authorization', async () => {
      await createUser();

      const response = await login().expect(200);

      await request(server)
        .get(`${API}/auth/me`)
        .set(
          'Cookie',
          `${ACCESS_TOKEN_COOKIE}=${cookieValue(response, ACCESS_TOKEN_COOKIE)}`,
        )
        .expect(200);
    });

    it('guarda a senha como argon2id e o refresh apenas como hash', async () => {
      const user = await createUser();
      const stored = await users.findById(user._id).select('+passwordHash').exec();

      expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(stored?.passwordHash).not.toContain(PASSWORD);

      const response = await login().expect(200);
      const session = await refreshTokens.findOne({}).select('+tokenHash').exec();

      expect(session?.tokenHash).toBe(sha256(response.body.refreshToken));
      expect(session?.tokenHash).not.toBe(response.body.refreshToken);
    });

    it('anota lastLoginAt', async () => {
      const user = await createUser();

      await login().expect(200);

      const stored = await users.findById(user._id).exec();

      expect(stored?.lastLoginAt).toBeInstanceOf(Date);
    });

    it('responde igual para senha errada, e-mail inexistente e usuario inativo', async () => {
      await createUser();

      const wrongPassword = await login(
        { password: 'senha-errada-porem-longa' },
        '198.51.100.1',
      );
      const unknownEmail = await login({ email: 'ninguem@maisonessence.com' }, '198.51.100.2');

      await users.updateOne({ email: EMAIL }, { $set: { isActive: false } });
      const inactive = await login({}, '198.51.100.3');

      for (const response of [wrongPassword, unknownEmail, inactive]) {
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Credenciais invalidas.');
      }

      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
      expect(inactive.body.message).toBe(wrongPassword.body.message);
      expect(inactive.body.error).toBe(wrongPassword.body.error);
    });

    it('recusa em tempo constante: nao entrega quais e-mails existem', async () => {
      await createUser();

      const existing = await measure(() =>
        login({ password: 'senha-errada-porem-longa' }, '198.51.100.4'),
      );
      const missing = await measure(() =>
        login({ email: 'ninguem@maisonessence.com' }, '198.51.100.5'),
      );

      // O piso de 350 ms cobre os dois caminhos; sem ele o e-mail inexistente
      // responderia em poucos milissegundos.
      expect(existing).toBeGreaterThanOrEqual(340);
      expect(missing).toBeGreaterThanOrEqual(340);
    });

    it('bloqueia na sexta tentativa da janela, com 429 generico', async () => {
      await createUser();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await login({ password: 'senha-errada-porem-longa' }, '192.0.2.77').expect(401);
      }

      const blocked = await login(
        { password: 'senha-errada-porem-longa' },
        '192.0.2.77',
      ).expect(429);

      // A frase e a do limite de rota, que age antes do contador de falhas do
      // servico: os dois valem cinco por quinze minutos, e quem chega primeiro
      // e o guard. As duas recusas sao igualmente mudas sobre o e-mail.
      expect(blocked.body.message).toBe(
        'Muitas requisicoes em pouco tempo. Espere um instante e tente de novo.',
      );
      expect(JSON.stringify(blocked.body)).not.toContain(EMAIL);

      // A senha certa tambem para: o bloqueio e da combinacao IP + e-mail.
      await login({}, '192.0.2.77').expect(429);
      // De outro IP, a mesma conta continua entrando.
      await login({}, '192.0.2.78').expect(200);
    });

    it('login aceito zera o contador de tentativas', async () => {
      await createUser();

      await login({ password: 'senha-errada-porem-longa' }, '192.0.2.90').expect(401);
      await login({}, '192.0.2.90').expect(200);

      await expect(loginAttempts.countDocuments({})).resolves.toBe(0);
    });

    it('recusa corpo invalido antes de qualquer consulta', async () => {
      await request(server)
        .post(`${API}/auth/login`)
        .send({ email: 'nao-e-email', password: 'x' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('renova a sessao com access token expirado, sem novo login', async () => {
      const user = await createUser();
      const session = await login().expect(200);
      const expired = await signExpiredAccessToken(user);

      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);

      const renewed = await request(server)
        .post(`${API}/auth/refresh`)
        .set(
          'Cookie',
          `${REFRESH_TOKEN_COOKIE}=${cookieValue(session, REFRESH_TOKEN_COOKIE)}`,
        )
        .expect(200);

      // O refresh sempre muda: cada rotacao emite um documento novo. O access
      // token pode sair identico quando as duas emissoes caem no mesmo
      // segundo — mesmas claims, mesmo `iat` —, o que so acontece em teste.
      expect(renewed.body.refreshToken).not.toBe(session.body.refreshToken);

      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${renewed.body.accessToken}`)
        .expect(200);
    });

    it('aceita o refresh token no corpo, para cliente sem cookie', async () => {
      await createUser();
      const session = await login().expect(200);

      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.body.refreshToken })
        .expect(200);
    });

    it('rotaciona: o token usado e revogado e aponta para o novo', async () => {
      await createUser();
      const session = await login().expect(200);

      const renewed = await request(server)
        .post(`${API}/auth/refresh`)
        .set('User-Agent', 'vitest')
        .send({ refreshToken: session.body.refreshToken })
        .expect(200);

      const used = await refreshTokens
        .findOne({ tokenHash: sha256(session.body.refreshToken) })
        .exec();
      const issued = await refreshTokens
        .findOne({ tokenHash: sha256(renewed.body.refreshToken) })
        .exec();

      expect(used?.revokedAt).toBeInstanceOf(Date);
      expect(used?.replacedBy?.toHexString()).toBe(issued?._id.toHexString());
      expect(issued?.revokedAt).toBeNull();
      expect(issued?.userAgent).toBe('vitest');
    });

    it('usar um refresh token duas vezes invalida todas as sessoes do usuario', async () => {
      const user = await createUser();
      const primeira = await login({}, '203.0.113.20').expect(200);
      const segunda = await login({}, '203.0.113.21').expect(200);

      const rotacionada = await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: primeira.body.refreshToken })
        .expect(200);

      // Reuso do token ja rotacionado.
      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: primeira.body.refreshToken })
        .expect(401);

      // A arvore inteira cai junto: o token emitido na rotacao e a sessao do
      // outro dispositivo.
      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: rotacionada.body.refreshToken })
        .expect(401);
      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: segunda.body.refreshToken })
        .expect(401);

      await expect(refreshTokens.countDocuments({ revokedAt: null })).resolves.toBe(0);

      // E os access tokens ja emitidos morrem junto, pela versao da credencial.
      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${segunda.body.accessToken}`)
        .expect(401);

      const stored = await users.findById(user._id).exec();

      expect(stored?.credentialVersion).toBeGreaterThan(user.credentialVersion);
    });

    it('recusa refresh de usuario desativado e derruba as sessoes dele', async () => {
      await createUser();
      const session = await login().expect(200);

      await users.updateOne({ email: EMAIL }, { $set: { isActive: false } });

      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.body.refreshToken })
        .expect(401);

      await expect(refreshTokens.countDocuments({ revokedAt: null })).resolves.toBe(0);
    });

    it('sem token nenhum responde 401', async () => {
      await request(server).post(`${API}/auth/refresh`).send({}).expect(401);
    });

    it('recusa access token apresentado como refresh', async () => {
      await createUser();
      const session = await login().expect(200);

      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.body.accessToken })
        .expect(401);
    });
  });

  describe('POST /auth/logout e /auth/logout-all', () => {
    it('logout revoga a sessao apresentada e limpa os cookies', async () => {
      await createUser();
      const session = await login().expect(200);

      const response = await request(server)
        .post(`${API}/auth/logout`)
        .set(
          'Cookie',
          `${REFRESH_TOKEN_COOKIE}=${cookieValue(session, REFRESH_TOKEN_COOKIE)}`,
        )
        .expect(204);

      expect(cookieValue(response, ACCESS_TOKEN_COOKIE)).toBe('');
      expect(cookieValue(response, REFRESH_TOKEN_COOKIE)).toBe('');

      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.body.refreshToken })
        .expect(401);
    });

    it('logout sem token nenhum tambem responde 204', async () => {
      await request(server).post(`${API}/auth/logout`).send({}).expect(204);
    });

    it('logout-all derruba as outras sessoes e os access tokens abertos', async () => {
      await createUser();
      const primeira = await login({}, '203.0.113.30').expect(200);
      const segunda = await login({}, '203.0.113.31').expect(200);

      await request(server)
        .post(`${API}/auth/logout-all`)
        .set('Authorization', `Bearer ${primeira.body.accessToken}`)
        .expect(204);

      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: segunda.body.refreshToken })
        .expect(401);
      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${segunda.body.accessToken}`)
        .expect(401);
    });

    it('logout-all exige autenticacao', async () => {
      await request(server).post(`${API}/auth/logout-all`).expect(401);
    });
  });

  describe('protecao por padrao', () => {
    it('rota nova nasce protegida', async () => {
      await request(server).get(`${API}/admin-probe`).expect(401);
    });

    it('rota marcada @Public continua aberta', async () => {
      await request(server).get(`${API}/health`).expect(200);
    });

    it('recusa access token de usuario desativado depois da emissao', async () => {
      await createUser();
      const session = await login().expect(200);

      await users.updateOne({ email: EMAIL }, { $set: { isActive: false } });

      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(401);
    });

    it('recusa access token de versao de credencial antiga', async () => {
      await createUser();
      const session = await login().expect(200);

      await users.updateOne({ email: EMAIL }, { $inc: { credentialVersion: 1 } });

      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(401);
    });
  });

  describe('senha temporaria', () => {
    it('entra, carrega a flag no token e e barrado nas rotas administrativas', async () => {
      await createUser({ mustChangePassword: true });

      const session = await login().expect(200);

      expect(session.body.user.mustChangePassword).toBe(true);
      expect(decodePayload(session.body.accessToken)).toMatchObject({
        mustChangePassword: true,
      });

      const blocked = await request(server)
        .get(`${API}/admin-probe`)
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(403);

      expect(blocked.body.message).toBe('Troque a senha temporaria antes de usar o painel.');

      // O que ele precisa poder fazer nesse estado continua aberto.
      await request(server)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(200);
      await request(server)
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: session.body.refreshToken })
        .expect(200);
    });

    it('usuario sem pendencia acessa a rota administrativa', async () => {
      await createUser();
      const session = await login().expect(200);

      await request(server)
        .get(`${API}/admin-probe`)
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(200);
    });
  });
});

function rawCookie(response: Response, name: string): string {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`cookie ${name} ausente na resposta`);
  }

  return cookie;
}

function cookieValue(response: Response, name: string): string {
  const [pair] = rawCookie(response, name).split(';');

  return pair.slice(name.length + 1);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function decodePayload(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

async function measure(operation: () => Promise<unknown>): Promise<number> {
  const startedAt = Date.now();

  await operation();

  return Date.now() - startedAt;
}
