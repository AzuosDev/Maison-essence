import { INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { InstallmentService } from '../src/modules/payments/installment.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import {
  AuditEntry,
  PIX_KEY_TYPES,
  PaymentSettings,
  RefreshToken,
  USER_ROLES,
  User,
  type UserRole,
} from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

/** A chave PIX da loja. Nunca deve aparecer em rota publica. */
const PIX_KEY = 'contato@maisonessence.com.br';

describe('pagamento (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let refreshTokens: Model<RefreshToken>;
  let settings: Model<PaymentSettings>;
  let audit: Model<AuditEntry>;
  let installments: InstallmentService;
  let payments: PaymentsService;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    refreshTokens = app.get<Model<RefreshToken>>(getModelToken(RefreshToken.name));
    settings = app.get<Model<PaymentSettings>>(getModelToken(PaymentSettings.name));
    audit = app.get<Model<AuditEntry>>(getModelToken(AuditEntry.name));
    installments = app.get(InstallmentService);
    payments = app.get(PaymentsService);
    passwordHash = await app.get(PasswordService).hash(PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Apagado o documento unico, ele nasce de novo com os padroes na proxima
    // leitura: cada teste comeca de uma loja recem-instalada.
    await Promise.all([
      users.deleteMany({}),
      refreshTokens.deleteMany({}),
      settings.deleteMany({}),
      audit.deleteMany({}),
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

  function adminPayments(session: Session): request.Test {
    return request(server).get(`${API}/admin/payment-settings`).set(as(session));
  }

  function patch(session: Session, body: Record<string, unknown>): request.Test {
    return request(server).patch(`${API}/admin/payment-settings`).set(as(session)).send(body);
  }

  function publicPayments(): request.Test {
    return request(server).get(`${API}/payment-settings`);
  }

  describe('GET /admin/payment-settings', () => {
    it('recusa quem nao esta autenticado', async () => {
      await request(server).get(`${API}/admin/payment-settings`).expect(401);
    });

    it('recusa o STAFF: a chave PIX da loja nao e do vendedor', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await adminPayments(staff).expect(403);
    });

    it('cria o documento unico com os padroes na primeira leitura', async () => {
      const owner = await signedInOwner();

      const response = await adminPayments(owner).expect(200);

      expect(response.body).toMatchObject({
        acceptsPix: true,
        pixKey: '',
        pixKeyType: PIX_KEY_TYPES.RANDOM,
        pixDiscountPercent: 0,
        acceptsCard: true,
        maxInstallments: 12,
        interestFreeUpTo: 3,
        minInstallmentCents: 2000,
      });
      expect(await settings.countDocuments({})).toBe(1);
    });
  });

  describe('PATCH /admin/payment-settings', () => {
    it('grava as regras do cartao', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        maxInstallments: 6,
        interestFreeUpTo: 2,
        monthlyInterestPercent: 1.99,
        minInstallmentCents: 3000,
      }).expect(200);

      expect(response.body).toMatchObject({
        maxInstallments: 6,
        interestFreeUpTo: 2,
        monthlyInterestPercent: 1.99,
        minInstallmentCents: 3000,
      });
    });

    it('normaliza a chave PIX junto do tipo', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        pixKey: '123.456.789-09',
        pixKeyType: PIX_KEY_TYPES.CPF,
      }).expect(200);

      expect(response.body.pixKey).toBe('12345678909');
    });

    it('recusa chave que nao corresponde ao tipo', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        pixKey: PIX_KEY,
        pixKeyType: PIX_KEY_TYPES.CPF,
      }).expect(422);

      expect(String(response.body.message)).toMatch(/11 digitos/);
    });

    /**
     * Trocar so o tipo tambem passa pela conferencia: a chave gravada
     * continua la, e o par incoerente faria a rota publica anunciar "chave:
     * CPF" para um e-mail.
     */
    it('reconfere a chave gravada quando so o tipo muda', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pixKey: PIX_KEY, pixKeyType: PIX_KEY_TYPES.EMAIL }).expect(200);

      await patch(owner, { pixKeyType: PIX_KEY_TYPES.CPF }).expect(422);

      expect((await adminPayments(owner).expect(200)).body).toMatchObject({
        pixKey: PIX_KEY,
        pixKeyType: PIX_KEY_TYPES.EMAIL,
      });
    });

    it('recusa desconto acima do teto', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pixDiscountPercent: 60 }).expect(400);
    });

    it('recusa parcela sem juros alem do total de parcelas', async () => {
      const owner = await signedInOwner();

      // Regra do schema, e nao do DTO: vale tambem para o seed e para um
      // script de manutencao.
      const response = await patch(owner, {
        maxInstallments: 6,
        interestFreeUpTo: 10,
      }).expect(422);

      expect(String(response.body.message)).toMatch(/parcelas sem juros/);
    });

    it('recusa o STAFF', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await patch(staff, { acceptsCard: false }).expect(403);
    });

    it('registra na auditoria quem mudou o que', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pixDiscountPercent: 5, acceptsCard: false }).expect(200);

      const entry = await audit.findOne({ action: 'payment-settings.updated' }).exec();

      expect(entry).not.toBeNull();
      expect(entry?.toJSON()).toMatchObject({
        action: 'payment-settings.updated',
        actorId: owner.id,
        actorEmail: 'dona@maisonessence.com',
        actorRole: USER_ROLES.OWNER,
        changes: {
          pixDiscountPercent: { from: 0, to: 5 },
          acceptsCard: { from: true, to: false },
        },
      });
    });

    it('a chave PIX nunca entra na trilha por inteiro', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pixKey: PIX_KEY, pixKeyType: PIX_KEY_TYPES.EMAIL }).expect(200);

      const entry = await audit.findOne({ action: 'payment-settings.updated' }).exec();
      const changes = entry?.changes as Record<string, { to: unknown }>;

      // O suficiente para provar que a chave mudou, insuficiente para
      // alguem copiar do log a conta que recebe o dinheiro da loja.
      expect(changes['pixKey'].to).toBe(`****${PIX_KEY.slice(-4)}`);
      expect(JSON.stringify(entry?.toJSON())).not.toContain(PIX_KEY);
    });

    it('nao polui a trilha com gravacao que nao mudou nada', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pixDiscountPercent: 5 }).expect(200);

      const logged = vi.spyOn(Logger.prototype, 'log');

      await patch(owner, { pixDiscountPercent: 5 }).expect(200);

      const entries = logged.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('payment-settings.updated'));

      logged.mockRestore();

      expect(entries).toHaveLength(0);
    });
  });

  describe('GET /payment-settings (publica)', () => {
    it('nao exige autenticacao e expoe o tipo da chave, nunca a chave', async () => {
      const owner = await signedInOwner();

      await patch(owner, {
        pixKey: PIX_KEY,
        pixKeyType: PIX_KEY_TYPES.EMAIL,
        pixDiscountPercent: 5,
      }).expect(200);

      const response = await publicPayments().expect(200);

      expect(response.body.pix).toEqual({
        keyType: PIX_KEY_TYPES.EMAIL,
        hasKey: true,
        discountPercent: 5,
      });
      // Em nenhum canto da resposta, nem dentro de outro campo.
      expect(JSON.stringify(response.body)).not.toContain(PIX_KEY);
    });

    it('avisa quando o PIX esta ligado mas sem chave configurada', async () => {
      const response = await publicPayments().expect(200);

      expect(response.body.pix).toMatchObject({ hasKey: false });
    });

    it('entrega as regras do cartao para a vitrine montar o parcelamento', async () => {
      const response = await publicPayments().expect(200);

      expect(response.body.card).toEqual({
        maxInstallments: 12,
        interestFreeUpTo: 3,
        monthlyInterestPercent: 0,
        minInstallmentCents: 2000,
      });
    });

    /** Criterio de aceite: desativar o cartao faz a opcao sumir da rota. */
    it('cartao desativado some da resposta publica', async () => {
      const owner = await signedInOwner();

      await patch(owner, { acceptsCard: false }).expect(200);

      const response = await publicPayments().expect(200);

      expect(response.body.card).toBeNull();
      // Nao e so a bandeira que sai: as regras de parcelamento saem junto, e
      // nao ha como a tela exibir por engano um "12x" que a loja nao oferece.
      expect(JSON.stringify(response.body)).not.toContain('maxInstallments');
    });

    it('PIX desativado some da resposta publica', async () => {
      const owner = await signedInOwner();

      await patch(owner, { acceptsPix: false }).expect(200);

      expect((await publicPayments().expect(200)).body.pix).toBeNull();
    });

    it('pede cinco minutos de cache na borda e responde 304 na revalidacao', async () => {
      const primeira = await publicPayments().expect(200);

      expect(primeira.headers['cache-control']).toBe(
        'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      );

      const revalidacao = await publicPayments()
        .set('If-None-Match', primeira.headers.etag)
        .expect(304);

      expect(revalidacao.body).toEqual({});
      expect(revalidacao.headers['cache-control']).toContain('s-maxage=300');
    });

    it('o PATCH do painel muda o ETag, e a borda larga a copia velha', async () => {
      const owner = await signedInOwner();
      const antes = await publicPayments().expect(200);

      await patch(owner, { acceptsCard: false }).expect(200);

      const depois = await publicPayments().set('If-None-Match', antes.headers.etag).expect(200);

      expect(depois.headers.etag).not.toBe(antes.headers.etag);
      expect(depois.body.card).toBeNull();
    });
  });

  describe('InstallmentService.buildOptions', () => {
    /**
     * Criterio de aceite: com 12 parcelas no maximo e minimo de R$ 20, um
     * total de R$ 100 devolve no maximo 5 opcoes.
     */
    it('R$ 100 nas regras padrao devolve 5 opcoes', async () => {
      const options = await installments.buildOptions(10_000);

      expect(options).toHaveLength(5);
      expect(options.map((option) => option.number)).toEqual([1, 2, 3, 4, 5]);
    });

    /** Criterio de aceite: a soma das parcelas e identica ao total. */
    it('a soma das parcelas fecha com o total de cada opcao', async () => {
      const owner = await signedInOwner();

      await patch(owner, { monthlyInterestPercent: 1.99 }).expect(200);

      for (const option of await installments.buildOptions(99_999)) {
        expect(
          option.firstInstallmentCents + option.installmentCents * (option.number - 1),
        ).toBe(option.totalCents);
      }
    });

    it('sem cartao aceito nao ha opcao nenhuma', async () => {
      const owner = await signedInOwner();

      await patch(owner, { acceptsCard: false }).expect(200);

      expect(await installments.buildOptions(100_000)).toEqual([]);
    });

    it('a regra trocada no painel vale no calculo seguinte, sem redeploy', async () => {
      const owner = await signedInOwner();

      const antes = await installments.buildOptions(100_000);

      await patch(owner, { maxInstallments: 6 }).expect(200);

      const depois = await installments.buildOptions(100_000);

      expect(antes).toHaveLength(12);
      expect(depois).toHaveLength(6);
    });
  });

  describe('PaymentsService.pixQuote', () => {
    /** Requisito 6: o desconto do PIX nunca alcanca a taxa de entrega. */
    it('desconta o subtotal e deixa a entrega inteira', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pixDiscountPercent: 5 }).expect(200);

      expect(await payments.pixQuote(10_000, 2500)).toEqual({
        discountCents: 500,
        totalCents: 12_000,
      });
    });

    it('PIX desligado nao da desconto, mesmo com percentual gravado', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pixDiscountPercent: 5 }).expect(200);
      await patch(owner, { acceptsPix: false }).expect(200);

      expect(await payments.pixQuote(10_000, 2500)).toEqual({
        discountCents: 0,
        totalCents: 12_500,
      });
    });
  });
});
