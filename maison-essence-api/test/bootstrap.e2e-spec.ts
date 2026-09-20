import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { BOOTSTRAP_SECRET_HEADER } from '../src/modules/auth/guards/bootstrap-secret.guard.js';
import { USER_ROLES, User } from '../src/schemas.js';

const API = '/api/v1';
const SECRET = process.env.BOOTSTRAP_SECRET ?? '';
const EMAIL = process.env.BOOTSTRAP_SUPERADMIN_EMAIL ?? '';
const PASSWORD = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ?? '';

describe('POST /auth/bootstrap (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    // `autoIndex` so vale em desenvolvimento, entao o banco do teste sobe sem
    // indice — o mesmo estado de um cluster novo no Atlas. Quem os cria la e o
    // `seed-runner`; aqui e este createIndexes, e sem o unico de `email` o
    // teste de chamadas simultaneas nao teria o que provar.
    await users.createIndexes();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await users.deleteMany({});
  });

  /** `null` manda a chamada sem o header. */
  function bootstrap(secret: string | null = SECRET) {
    const call = request(server).post(`${API}/auth/bootstrap`);

    return secret === null ? call : call.set(BOOTSTRAP_SECRET_HEADER, secret);
  }

  it('cria o primeiro SUPER_ADMIN num banco vazio', async () => {
    const response = await bootstrap().expect(201);

    expect(response.body.user).toMatchObject({
      email: EMAIL,
      role: USER_ROLES.SUPER_ADMIN,
      isActive: true,
      // A senha veio de uma variavel de ambiente: serve para entrar uma vez.
      mustChangePassword: true,
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const stored = await users.findOne({ email: EMAIL }).select('+passwordHash').exec();

    // argon2id, nunca bcrypt nem sha: o prefixo do hash e a prova.
    expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('o usuario criado entra pelo login normal, ja com a troca pendente', async () => {
    await bootstrap().expect(201);

    const login = await request(server)
      .post(`${API}/auth/login`)
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    expect(login.body.user.mustChangePassword).toBe(true);

    // Com a senha temporaria, o painel esta trancado fora da troca de senha.
    await request(server)
      .get(`${API}/users`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('recusa sem o header e com o segredo errado', async () => {
    await bootstrap(null).expect(401);
    await bootstrap('segredo-errado-com-mais-de-32-caracteres').expect(401);

    expect(await users.countDocuments({})).toBe(0);
  });

  it('responde 409 quando ja existe qualquer usuario, nem que seja STAFF', async () => {
    await users.create({
      name: 'Atendente',
      email: 'staff@maisonessence.com',
      passwordHash: 'irrelevante',
      role: USER_ROLES.STAFF,
    });

    const response = await bootstrap().expect(409);

    // Mensagem sem o e-mail de quem bloqueou: quem chama a rota ainda esta do
    // lado de fora do painel.
    expect(String(response.body.message)).not.toContain('staff@maisonessence.com');
    expect(await users.countDocuments({})).toBe(1);
  });

  it('chamar duas vezes nao cria dois super-admins', async () => {
    await bootstrap().expect(201);
    await bootstrap().expect(409);

    expect(await users.countDocuments({ role: USER_ROLES.SUPER_ADMIN })).toBe(1);
  });

  it('duas chamadas simultaneas num banco vazio ainda criam um so', async () => {
    const [first, second] = await Promise.all([bootstrap(), bootstrap()]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);

    // Uma vence e cria; a outra cai no indice unico de e-mail e vira 409.
    expect(statuses).toEqual([201, 409]);
    expect(await users.countDocuments({})).toBe(1);
  });
});
