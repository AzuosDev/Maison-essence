import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DOCS_PATH, configureApp } from '../src/bootstrap.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { BODY_TOO_LARGE_MESSAGE } from '../src/common/filters/all-exceptions.filter.js';
import { JsonLogger } from '../src/common/json-logger.js';
import { REQUEST_ID_HEADER } from '../src/common/request-id.middleware.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { AuditEntry, RateLimitHit, USER_ROLES, User } from '../src/schemas.js';

const API = '/api/v1';
const EMAIL = 'dona@maisonessence.com';
const PASSWORD = 'senha-longa-do-painel-2026';

/** Um telefone e um token de verdade, do tamanho e do formato que vazam. */
const PHONE = '(88) 99999-1234';
const PHONE_DIGITS = '88999991234';
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMxMjMifQ.ZmFrZS1zaWduYXR1cmE';

/** A origem que o .env de teste libera. */
const ALLOWED_ORIGIN = 'http://localhost:5173';

/**
 * Uma rota que erra do jeito que se erra de verdade.
 *
 * Existe para o teste do log ter o que esconder. Sem ela a garantia "nenhum
 * log contem telefone ou token" passaria por nao haver nada nos logs — e e
 * justamente o dia em que alguem escrever a linha errada que a rede precisa
 * estar armada.
 */
@Controller('probe')
class LeakyProbeController {
  private readonly logger = new Logger('LeakyProbe');

  @Public()
  @Get('leak')
  leak(): { ok: true } {
    this.logger.warn(`Cliente ${PHONE} autenticou com Bearer ${TOKEN}`);

    return { ok: true };
  }
}

describe('endurecimento (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let audit: Model<AuditEntry>;
  let hits: Model<RateLimitHit>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [LeakyProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    // Em teste o logger da aplicacao fica so com warn e error, para nao
    // atravessar o terminal a cada requisicao. Aqui os niveis voltam, porque
    // o que este arquivo confere e justamente o conteudo das linhas.
    app.useLogger(new JsonLogger(['fatal', 'error', 'warn', 'log']));
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    audit = app.get<Model<AuditEntry>>(getModelToken(AuditEntry.name));
    hits = app.get<Model<RateLimitHit>>(getModelToken(RateLimitHit.name));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await Promise.all([users.deleteMany({}), audit.deleteMany({}), hits.deleteMany({})]);
  });

  async function createOwner(): Promise<void> {
    await users.create({
      name: 'Dona da loja',
      email: EMAIL,
      passwordHash: await app.get(PasswordService).hash(PASSWORD),
      role: USER_ROLES.OWNER,
      isActive: true,
      mustChangePassword: false,
    });
  }

  function login(password: string, ip = '203.0.113.20'): request.Test {
    return request(server)
      .post(`${API}/auth/login`)
      .set('X-Forwarded-For', ip)
      .send({ email: EMAIL, password });
  }

  /** Tudo o que a aplicacao escrever enquanto `work` roda. */
  async function captureLogs(work: () => Promise<void>): Promise<string> {
    const lines: string[] = [];
    const streams = [process.stdout, process.stderr] as const;
    const originals = streams.map((stream) => stream.write.bind(stream));

    for (const stream of streams) {
      stream.write = ((chunk: string | Uint8Array): boolean => {
        lines.push(String(chunk));

        return true;
      }) as typeof stream.write;
    }

    try {
      await work();
    } finally {
      streams.forEach((stream, index) => {
        stream.write = originals[index] as typeof stream.write;
      });
    }

    return lines.join('');
  }

  describe('limite de chamadas', () => {
    it('a sexta tentativa de login do mesmo IP responde 429', async () => {
      await createOwner();

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await login('senha-errada-porem-longa').expect(401);
      }

      const blocked = await login('senha-errada-porem-longa').expect(429);

      expect(blocked.body.message).toBe(
        'Muitas requisicoes em pouco tempo. Espere um instante e tente de novo.',
      );
      // Diz quando voltar, sem dizer quanto ja foi gasto.
      expect(blocked.headers['retry-after']).toBeDefined();
    });

    it('a senha certa tambem para: o limite e da rota, nao da credencial', async () => {
      await createOwner();

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await login('senha-errada-porem-longa').expect(401);
      }

      await login(PASSWORD).expect(429);
      // De outro IP, a mesma conta entra normalmente.
      await login(PASSWORD, '203.0.113.21').expect(200);
    });

    it('o contador vive no banco, e nao na memoria do processo', async () => {
      await createOwner();
      await login('senha-errada-porem-longa').expect(401);

      // Uma instancia serverless nova nao teria como saber disso se o contador
      // fosse um Map: e o documento que atravessa as invocacoes.
      expect(await hits.countDocuments()).toBeGreaterThan(0);
    });

    it('rota publica sem regra propria tambem tem teto', async () => {
      const response = await request(server).get(`${API}/health`).expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('120');
    });
  });

  describe('injecao de operador do Mongo', () => {
    it('recusa com 400 a chave que comeca com cifrao', async () => {
      const response = await request(server)
        .post(`${API}/auth/login`)
        .send({ email: { $ne: null }, password: 'qualquer-coisa-longa' })
        .expect(400);

      expect(response.body.message).toContain('$ne');
      expect(response.body.error).toBe('Bad Request');
    });

    it('recusa a chave com ponto, em qualquer profundidade', async () => {
      await request(server)
        .post(`${API}/cart/quote`)
        .send({ items: [{ 'produto.preco': 1 }] })
        .expect(400);
    });

    it('nao atrapalha o corpo legitimo', async () => {
      await createOwner();

      await login(PASSWORD).expect(200);
    });
  });

  describe('tamanho do corpo', () => {
    it('recusa corpo acima de 256 KB com 413, e nao com 500', async () => {
      const response = await request(server)
        .post(`${API}/cart/quote`)
        .send({ items: [], observacao: 'x'.repeat(300 * 1024) });

      // O parser do Express lanca um Error comum, fora do Nest. Sem
      // traducao no filtro, a defesa funcionando se anunciava como falha do
      // servidor — 500, com a pilha inteira no log.
      expect(response.status).toBe(413);
      expect(response.body.message).toBe(BODY_TOO_LARGE_MESSAGE);
      expect(response.body.error).toBe('Payload Too Large');
    });

    it('le o corpo grande que cabe no teto, em vez de corta-lo', async () => {
      // Duas mil linhas de sacola dao uns 200 KB: passa do padrao do Express,
      // que e 100 KB, e cabe no teto novo. A recusa que vem e a do DTO, que
      // aceita 50 itens — e e ela que prova que o corpo chegou inteiro ate a
      // validacao, em vez de ter sido cortado pelo tamanho.
      const items = Array.from({ length: 2000 }, () => ({
        productId: '65f0a1b2c3d4e5f6a7b8c9d0',
        variantId: '65f0a1b2c3d4e5f6a7b8c9d1',
        quantity: 1,
      }));
      const body = {
        items,
        fulfillment: { mode: 'PICKUP' },
        payment: { method: 'PIX' },
      };

      expect(JSON.stringify(body).length).toBeGreaterThan(150 * 1024);

      const response = await request(server).post(`${API}/cart/quote`).send(body);

      expect(response.status).toBe(400);
      expect(String(response.body.message)).toContain('no maximo 50 itens');
    });
  });

  describe('cabecalhos e origem', () => {
    it('responde com CSP, HSTS e nosniff', async () => {
      const response = await request(server).get(`${API}/health`).expect(200);

      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(response.headers['strict-transport-security']).toContain('max-age=');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('devolve o identificador da requisicao, e reaproveita o que veio', async () => {
      const gerado = await request(server).get(`${API}/health`).expect(200);

      expect(gerado.headers[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);

      const recebido = await request(server)
        .get(`${API}/health`)
        .set(REQUEST_ID_HEADER, 'vindo-da-borda')
        .expect(200);

      expect(recebido.headers[REQUEST_ID_HEADER]).toBe('vindo-da-borda');
    });

    it('libera a origem que esta na lista', async () => {
      const response = await request(server)
        .get(`${API}/health`)
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('nao libera origem de fora da lista, e nunca responde com curinga', async () => {
      const response = await request(server)
        .get(`${API}/health`)
        .set('Origin', 'https://loja-falsa.example')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('documentacao', () => {
    it('publica a especificacao em /api/v1/docs', async () => {
      const response = await request(server).get(`/${DOCS_PATH}-json`).expect(200);

      expect(response.body.info.title).toBe('Maison Essence API');
      expect(response.body.paths[`${API}/orders`]).toBeDefined();
      expect(response.body.paths[`${API}/auth/login`]).toBeDefined();
    });

    it('a pagina da documentacao carrega com a politica afrouxada so ali', async () => {
      const response = await request(server).get(`/${DOCS_PATH}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    });
  });

  describe('auditoria e log', () => {
    it('o login entra na trilha, o certo e o errado', async () => {
      await createOwner();

      await login('senha-errada-porem-longa').expect(401);
      await login(PASSWORD).expect(200);

      const recusado = await audit.findOne({ action: 'login.failed' }).exec();
      const aceito = await audit.findOne({ action: 'login.succeeded' }).exec();

      expect(recusado?.toJSON()).toMatchObject({
        actorId: 'anonimo',
        actorEmail: EMAIL,
        actorRole: null,
        details: { reason: 'senha_incorreta' },
      });
      expect(aceito?.toJSON()).toMatchObject({
        actorEmail: EMAIL,
        actorRole: USER_ROLES.OWNER,
      });
      // A trilha liga a requisicao as linhas de log dela.
      expect(aceito?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('nenhuma linha de log carrega telefone completo ou token', async () => {
      await createOwner();

      const logs = await captureLogs(async () => {
        await request(server).get(`${API}/probe/leak`).expect(200);
        await login('senha-errada-porem-longa').expect(401);
        await login(PASSWORD).expect(200);
      });

      // A linha existe — o teste nao passa por falta de log.
      expect(logs).toContain('LeakyProbe');
      expect(logs).not.toContain(PHONE_DIGITS);
      expect(logs).not.toContain(PHONE);
      expect(logs).not.toContain(TOKEN);
      expect(logs).not.toContain('eyJ');
      expect(logs).not.toContain(PASSWORD);
      // O que sobrou continua servindo para identificar o cliente.
      expect(logs).toContain('88*******34');
      expect(logs).toContain('[token]');
    });

    it('cada linha e um JSON com nivel, contexto e requestId', async () => {
      const logs = await captureLogs(async () => {
        await request(server)
          .get(`${API}/probe/leak`)
          .set(REQUEST_ID_HEADER, 'requisicao-de-teste')
          .expect(200);
      });

      const line = logs
        .split('\n')
        .filter((entry) => entry.includes('LeakyProbe'))
        .map((entry) => JSON.parse(entry) as Record<string, unknown>)
        .at(0);

      expect(line).toMatchObject({
        level: 'warn',
        context: 'LeakyProbe',
        requestId: 'requisicao-de-teste',
      });
      expect(typeof line?.time).toBe('string');
    });
  });
});
