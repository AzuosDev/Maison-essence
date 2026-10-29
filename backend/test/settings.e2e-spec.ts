import { INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import {
  AuditEntry,
  INSTITUTIONAL_PAGE_SLUGS,
  RefreshToken,
  StoreSettings,
  USER_ROLES,
  User,
  type UserRole,
} from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

/** Artes de banner validas: `publicId` dentro da pasta da loja. */
const BANNER_IMAGE = 'maison-essence/banners/natal-2026';
const BANNER_IMAGE_MOBILE = 'maison-essence/banners/natal-2026-mobile';

/** Instantes fixos para o agendamento, longe da hora em que o teste roda. */
const PAST_START = '2026-01-01T00:00:00.000Z';
const PAST_END = '2026-02-01T00:00:00.000Z';
const FUTURE_START = '2099-01-01T00:00:00.000Z';

describe('configuracoes da loja (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let refreshTokens: Model<RefreshToken>;
  let settings: Model<StoreSettings>;
  let audit: Model<AuditEntry>;
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
    audit = app.get<Model<AuditEntry>>(getModelToken(AuditEntry.name));
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

  /** O gerente da loja, que e quem o painel de configuracoes atende. */
  function signedInOwner(): Promise<Session> {
    return signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
  }

  /** Quem mantem o sistema, e a unica pessoa que mexe na moldura da loja. */
  function signedInAdmin(): Promise<Session> {
    return signedIn(USER_ROLES.SUPER_ADMIN, 'dev@maisonessence.com');
  }

  function adminSettings(session: Session): request.Test {
    return request(server).get(`${API}/admin/settings`).set(as(session));
  }

  function patch(session: Session, body: Record<string, unknown>): request.Test {
    return request(server).patch(`${API}/admin/settings`).set(as(session)).send(body);
  }

  function publicSettings(): request.Test {
    return request(server).get(`${API}/settings`);
  }

  describe('GET /admin/settings', () => {
    it('recusa quem nao esta autenticado', async () => {
      await request(server).get(`${API}/admin/settings`).expect(401);
    });

    it('recusa o STAFF: o destino do pedido nao e coisa de vendedor', async () => {
      const staff = await signedIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await adminSettings(staff).expect(403);
    });

    it('cria o documento unico na primeira leitura, com os padroes', async () => {
      const owner = await signedInOwner();

      const response = await adminSettings(owner).expect(200);

      expect(response.body).toMatchObject({
        storeName: 'Maison Essence',
        whatsappNumber: '',
        announcementText: '',
        pickupEnabled: false,
        banners: [],
      });
      await expect(settings.countDocuments({})).resolves.toBe(1);
    });

    it('lista as seis paginas mesmo antes de alguem escreve-las', async () => {
      const owner = await signedInOwner();

      const response = await adminSettings(owner).expect(200);
      const pages = response.body.institutionalPages as {
        slug: string;
        content: string;
        isActive: boolean;
      }[];

      expect(pages.map((page) => page.slug)).toEqual([
        INSTITUTIONAL_PAGE_SLUGS.ABOUT,
        INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY,
        INSTITUTIONAL_PAGE_SLUGS.USAGE,
        INSTITUTIONAL_PAGE_SLUGS.RETURNS,
        INSTITUTIONAL_PAGE_SLUGS.FAQ,
        INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
      ]);
      // As seis sobem escritas e publicadas, com o texto da loja (ver
      // `DEFAULT_INSTITUTIONAL_PAGES`): o painel abre com seis formularios
      // preenchidos, e nao com dois em branco esperando alguem lembrar.
      expect(pages.every((page) => page.content !== '')).toBe(true);
      expect(pages.every((page) => page.isActive)).toBe(true);
    });
  });

  describe('PATCH /admin/settings', () => {
    it('normaliza o numero do WhatsApp colado do celular', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, { whatsappNumber: '+55 (88) 99999-9999' }).expect(
        200,
      );

      expect(response.body.whatsappNumber).toBe('5588999999999');

      const stored = await settings.findOne({}).lean().exec();

      expect(stored?.whatsappNumber).toBe('5588999999999');
    });

    it('recusa o que nao e numero, dizendo o formato esperado', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, { whatsappNumber: 'fale comigo no zap' }).expect(400);

      expect(String(response.body.message)).toMatch(/formato internacional/);
      expect(String(response.body.message)).toMatch(/5588999999999/);
    });

    it('recusa numero curto demais para ter pais e DDD', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, { whatsappNumber: '99999999' }).expect(400);

      expect(String(response.body.message)).toMatch(/formato internacional/);
    });

    it('aceita vazio, que e a loja sem WhatsApp configurado', async () => {
      const owner = await signedInOwner();

      await patch(owner, { whatsappNumber: '5588999999999' }).expect(200);
      const response = await patch(owner, { whatsappNumber: '' }).expect(200);

      expect(response.body.whatsappNumber).toBe('');
    });

    it('guarda o resto do cadastro da loja', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        storeName: 'Maison Essence Sobral',
        announcementText: 'Frete gratis acima de R$ 199',
        contactEmail: 'Contato@MaisonEssence.com',
        businessHours: 'Seg a Sex, 9h as 18h',
        socialLinks: { instagram: '@maisonessence' },
      }).expect(200);

      expect(response.body).toMatchObject({
        storeName: 'Maison Essence Sobral',
        announcementText: 'Frete gratis acima de R$ 199',
        // O schema grava o e-mail em minuscula.
        contactEmail: 'contato@maisonessence.com',
        businessHours: 'Seg a Sex, 9h as 18h',
        socialLinks: { instagram: '@maisonessence', tiktok: '' },
      });
    });

    it('funde os blocos aninhados campo a campo', async () => {
      const admin = await signedInAdmin();

      await patch(admin, {
        pickupEnabled: true,
        pickupAddress: {
          street: 'Rua Coronel Mont Alverne',
          number: '120',
          district: 'Centro',
          city: 'Sobral',
          state: 'ce',
          zipCode: '62010-030',
          reference: 'Em frente a praca',
        },
        socialLinks: { instagram: '@maisonessence', tiktok: '@maisonessence' },
      }).expect(200);

      // Corrigir o numero da casa nao pode apagar o ponto de referencia, nem
      // trocar o Instagram sumir com o TikTok.
      const response = await patch(admin, {
        pickupAddress: { number: '122' },
        socialLinks: { instagram: '@maison.essence' },
      }).expect(200);

      expect(response.body.pickupAddress).toMatchObject({
        street: 'Rua Coronel Mont Alverne',
        number: '122',
        district: 'Centro',
        city: 'Sobral',
        // A sigla vai para o banco em maiuscula.
        state: 'CE',
        reference: 'Em frente a praca',
      });
      expect(response.body.socialLinks).toEqual({
        instagram: '@maison.essence',
        tiktok: '@maisonessence',
      });
    });

    it('registra na auditoria quem mudou o que', async () => {
      const owner = await signedInOwner();

      await patch(owner, {
        whatsappNumber: '5588999999999',
        pickupAddress: { city: 'Sobral' },
      }).expect(200);

      // Na colecao, e nao so no log: a trilha precisa sobreviver a
      // retencao de log do provedor para responder por uma alteracao de
      // tres meses atras.
      const entry = await audit.findOne({ action: 'settings.updated' }).exec();

      expect(entry).not.toBeNull();
      expect(entry?.toJSON()).toMatchObject({
        action: 'settings.updated',
        actorId: owner.id,
        actorEmail: 'dona@maisonessence.com',
        actorRole: USER_ROLES.OWNER,
        changes: {
          whatsappNumber: { from: '', to: '5588999999999' },
          'pickupAddress.city': { from: '', to: 'Sobral' },
        },
      });
      expect(entry?.createdAt).toBeInstanceOf(Date);
    });

    it('nao polui a trilha com gravacao que nao mudou nada', async () => {
      const owner = await signedInOwner();

      await patch(owner, { storeName: 'Maison Essence Sobral' }).expect(200);

      const logged = vi.spyOn(Logger.prototype, 'log');

      await patch(owner, { storeName: 'Maison Essence Sobral' }).expect(200);

      const entries = logged.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes('settings.updated'));

      logged.mockRestore();

      expect(entries).toHaveLength(0);
    });
  });

  describe('banners da home', () => {
    it('cria o banner com id proprio e ordena pelo campo order', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        banners: [
          { imageDesktop: BANNER_IMAGE, title: 'Segundo', order: 2 },
          { imageDesktop: BANNER_IMAGE_MOBILE, title: 'Primeiro', order: 1 },
        ],
      }).expect(200);

      const banners = response.body.banners as { id: string; title: string }[];

      expect(banners.map((banner) => banner.title)).toEqual(['Primeiro', 'Segundo']);
      expect(banners[0].id).toMatch(/^[0-9a-f]{24}$/);
    });

    it('grava a vaga do banner e assume o topo quando ela nao vem', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        banners: [
          { imageDesktop: BANNER_IMAGE, title: 'Meio', placement: 'middle', order: 0 },
          // Sem `placement`: e o que um painel antigo manda, e o que todo
          // banner gravado antes da vaga do meio existir parece no banco.
          { imageDesktop: BANNER_IMAGE, title: 'Topo', order: 1 },
        ],
      }).expect(200);

      const banners = response.body.banners as { title: string; placement: string }[];

      expect(banners.map((banner) => banner.placement)).toEqual(['middle', 'hero']);
    });

    it('recusa vaga de banner que nao existe', async () => {
      const admin = await signedInAdmin();

      await patch(admin, {
        banners: [{ imageDesktop: BANNER_IMAGE, placement: 'rodape' }],
      }).expect(400);
    });

    it('preserva o id do banner entre gravacoes', async () => {
      const admin = await signedInAdmin();

      const created = await patch(admin, {
        banners: [{ imageDesktop: BANNER_IMAGE, title: 'Natal' }],
      }).expect(200);
      const { id } = created.body.banners[0];

      const updated = await patch(admin, {
        banners: [{ id, imageDesktop: BANNER_IMAGE, title: 'Natal 2026' }],
      }).expect(200);

      expect(updated.body.banners[0].id).toBe(id);
      expect(updated.body.banners[0].title).toBe('Natal 2026');
    });

    it('recusa periodo que termina antes de comecar', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        banners: [{ imageDesktop: BANNER_IMAGE, startsAt: PAST_END, endsAt: PAST_START }],
      }).expect(422);

      expect(String(response.body.message)).toMatch(/termina antes de começar/);

      // Nada foi gravado: o carrossel continua vazio.
      const stored = await settings.findOne({}).lean().exec();

      expect(stored?.banners ?? []).toHaveLength(0);
    });

    it('recusa id de banner que nao existe mais', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        banners: [{ id: '000000000000000000000000', imageDesktop: BANNER_IMAGE }],
      }).expect(422);

      expect(response.body.details).toEqual({ unknownIds: ['000000000000000000000000'] });
    });

    it('recusa imagem de fora das pastas da loja', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        banners: [{ imageDesktop: 'https://exemplo.com/banner.png' }],
      }).expect(400);

      expect(String(response.body.message)).toMatch(/imagem inválida/);
    });
  });

  describe('GET /settings (publica)', () => {
    it('dispensa autenticacao e entrega so o subconjunto seguro', async () => {
      const admin = await signedInAdmin();

      await patch(admin, {
        whatsappNumber: '5588999999999',
        announcementText: 'Frete gratis acima de R$ 199',
        institutionalPages: [
          { slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, content: '# Quem somos', isActive: true },
        ],
      }).expect(200);

      const response = await publicSettings().expect(200);

      expect(response.body).toMatchObject({
        storeName: 'Maison Essence',
        whatsappNumber: '5588999999999',
        whatsappLink: 'https://wa.me/5588999999999',
        announcementText: 'Frete gratis acima de R$ 199',
      });
      // Estado do painel nao vaza para a vitrine.
      expect(response.body).not.toHaveProperty('updatedAt');
      expect(response.body).not.toHaveProperty('institutionalPages');
    });

    it('esconde o endereco enquanto a retirada esta desligada', async () => {
      const owner = await signedInOwner();

      await patch(owner, { pickupAddress: { city: 'Sobral' } }).expect(200);
      const desligada = await publicSettings().expect(200);

      expect(desligada.body.pickupAddress).toBeNull();

      await patch(owner, { pickupEnabled: true }).expect(200);
      const ligada = await publicSettings().expect(200);

      expect(ligada.body.pickupAddress).toMatchObject({ city: 'Sobral' });
    });

    it('trocar o numero no painel muda o destino do pedido, sem redeploy', async () => {
      const owner = await signedInOwner();

      await patch(owner, { whatsappNumber: '5588999999999' }).expect(200);
      const antes = await publicSettings().expect(200);

      expect(antes.body.whatsappLink).toBe('https://wa.me/5588999999999');

      await patch(owner, { whatsappNumber: '(88) 98888-8888' }).expect(200);
      const depois = await publicSettings().expect(200);

      expect(depois.body.whatsappLink).toBe('https://wa.me/5588988888888');
    });

    it('nao entrega banner cuja data de fim ja passou', async () => {
      const admin = await signedInAdmin();

      const painel = await patch(admin, {
        banners: [
          { imageDesktop: BANNER_IMAGE, title: 'No ar', order: 0 },
          {
            imageDesktop: BANNER_IMAGE,
            title: 'Promocao encerrada',
            order: 1,
            startsAt: PAST_START,
            endsAt: PAST_END,
          },
          { imageDesktop: BANNER_IMAGE, title: 'Agendado', order: 2, startsAt: FUTURE_START },
          { imageDesktop: BANNER_IMAGE, title: 'Desligado', order: 3, isActive: false },
        ],
      }).expect(200);

      // O painel continua vendo os quatro: o que saiu do ar nao foi apagado.
      expect(painel.body.banners).toHaveLength(4);

      const response = await publicSettings().expect(200);
      const banners = response.body.banners as { title: string }[];

      expect(banners.map((banner) => banner.title)).toEqual(['No ar']);
      // A vitrine nao recebe o agendamento nem o desligamento.
      expect(banners[0]).not.toHaveProperty('startsAt');
      expect(banners[0]).not.toHaveProperty('isActive');
    });

    it('cai na arte de desktop quando o banner nao tem arte de celular', async () => {
      const admin = await signedInAdmin();

      await patch(admin, { banners: [{ imageDesktop: BANNER_IMAGE }] }).expect(200);

      const response = await publicSettings().expect(200);

      expect(response.body.banners[0].imageMobile).toBe(BANNER_IMAGE);
    });

    it('manda a CDN guardar por cinco minutos', async () => {
      const response = await publicSettings().expect(200);

      expect(response.headers['cache-control']).toBe(
        'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      );
    });

    it('responde 304 para quem ja tem a versao', async () => {
      const primeira = await publicSettings().expect(200);
      const etag = primeira.headers.etag;

      expect(etag).toMatch(/^W\//);

      const revalidacao = await publicSettings().set('If-None-Match', etag).expect(304);

      expect(revalidacao.body).toEqual({});
      // O cabecalho de cache sai tambem no 304: sem ele a borda esqueceria a
      // janela justamente na revalidacao.
      expect(revalidacao.headers['cache-control']).toContain('s-maxage=300');
    });

    it('o PATCH do painel muda o ETag, e a borda larga a copia velha', async () => {
      const owner = await signedInOwner();

      const antes = await publicSettings().expect(200);

      await patch(owner, { announcementText: 'Chegou a colecao nova' }).expect(200);

      const depois = await publicSettings().set('If-None-Match', antes.headers.etag).expect(200);

      expect(depois.headers.etag).not.toBe(antes.headers.etag);
      expect(depois.body.announcementText).toBe('Chegou a colecao nova');
    });
  });

  describe('paginas institucionais publicas', () => {
    const ABOUT_CONTENT = '# Quem somos\n\nPerfumaria em Sobral desde 2019.';

    async function publishAbout(admin: Session): Promise<void> {
      await patch(admin, {
        institutionalPages: [
          {
            slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT,
            title: 'Quem somos',
            content: ABOUT_CONTENT,
            isActive: true,
          },
        ],
      }).expect(200);
    }

    /**
     * Despublica o texto de fabrica das outras tres paginas escritas.
     *
     * A loja recem-instalada ja responde com quatro paginas no ar (ver
     * `DEFAULT_INSTITUTIONAL_PAGES`). Quem quer olhar uma pagina sozinha na
     * listagem tira as outras do ar primeiro, do mesmo jeito que a dona
     * faria no painel.
     */
    async function hideShippedPages(admin: Session): Promise<void> {
      await patch(admin, {
        institutionalPages: [
          { slug: INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY, isActive: false },
          { slug: INSTITUTIONAL_PAGE_SLUGS.USAGE, isActive: false },
          { slug: INSTITUTIONAL_PAGE_SLUGS.RETURNS, isActive: false },
          { slug: INSTITUTIONAL_PAGE_SLUGS.FAQ, isActive: false },
          { slug: INSTITUTIONAL_PAGE_SLUGS.PRIVACY, isActive: false },
        ],
      }).expect(200);
    }

    it('ja nasce com as paginas que a loja tem texto para dizer', async () => {
      const response = await request(server).get(`${API}/pages`).expect(200);

      expect(response.body.map((page: { slug: string }) => page.slug)).toEqual([
        INSTITUTIONAL_PAGE_SLUGS.ABOUT,
        INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY,
        INSTITUTIONAL_PAGE_SLUGS.USAGE,
        INSTITUTIONAL_PAGE_SLUGS.RETURNS,
        INSTITUTIONAL_PAGE_SLUGS.FAQ,
        INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
      ]);
    });

    it('entrega o texto de fabrica sem o painel ter tocado na pagina', async () => {
      const response = await request(server)
        .get(`${API}/pages/${INSTITUTIONAL_PAGE_SLUGS.USAGE}`)
        .expect(200);

      expect(response.body.title).toBe('Modo de uso');
      expect(response.body.content).toContain('Como armazenar o perfume');
    });

    it('lista so as publicadas, com titulo e endereco', async () => {
      const admin = await signedInAdmin();

      await publishAbout(admin);
      await hideShippedPages(admin);

      const response = await request(server).get(`${API}/pages`).expect(200);

      expect(response.body).toEqual([
        { slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, title: 'Quem somos' },
      ]);
    });

    it('entrega o markdown como foi escrito', async () => {
      const admin = await signedInAdmin();

      await publishAbout(admin);

      const response = await request(server)
        .get(`${API}/pages/${INSTITUTIONAL_PAGE_SLUGS.ABOUT}`)
        .expect(200);

      expect(response.body).toEqual({
        slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT,
        title: 'Quem somos',
        content: ABOUT_CONTENT,
      });
    });

    it('responde 404 para pagina despublicada: de fora, ela nao existe', async () => {
      const admin = await signedInAdmin();

      await publishAbout(admin);
      await patch(admin, {
        institutionalPages: [{ slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, isActive: false }],
      }).expect(200);

      const response = await request(server)
        .get(`${API}/pages/${INSTITUTIONAL_PAGE_SLUGS.ABOUT}`)
        .expect(404);

      expect(response.body.message).toMatch(/não encontrada/);
    });

    it('responde 404 para endereco que nao e de pagina nenhuma', async () => {
      await request(server).get(`${API}/pages/promocoes`).expect(404);
    });

    it('recusa no painel um slug fora da lista fixa', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        institutionalPages: [{ slug: 'promocoes', title: 'Promocoes' }],
      }).expect(400);

      expect(String(response.body.message)).toMatch(/página desconhecida/);
    });
  });

  /**
   * A tela e uma, e a permissao dentro dela e duas.
   *
   * O gerente abre `/admin/settings` e grava o que muda no expediente. O que
   * e moldura da loja — o carrossel da home, o perfume da vez, as paginas do
   * rodape, as redes sociais — ele le e nao grava. Ver
   * `settings-access.policy.ts`.
   */
  describe('a divisao de Configuracoes por campo', () => {
    it('o gerente grava o cadastro da loja e a retirada', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        storeName: 'Maison Essence Sobral',
        whatsappNumber: '(88) 99999-9999',
        contactEmail: 'contato@maisonessence.com',
        businessHours: 'Seg a Sex, 9h as 18h',
        announcementText: 'Frete gratis acima de R$ 199',
        freeShippingMinCents: 19_900,
        pickupEnabled: true,
        pickupAddress: { city: 'Sobral', state: 'CE' },
        pickupInstructions: 'Toque a campainha do portao azul.',
      }).expect(200);

      expect(response.body).toMatchObject({
        storeName: 'Maison Essence Sobral',
        whatsappNumber: '5588999999999',
        contactEmail: 'contato@maisonessence.com',
        businessHours: 'Seg a Sex, 9h as 18h',
        announcementText: 'Frete gratis acima de R$ 199',
        freeShippingMinCents: 19_900,
        pickupEnabled: true,
      });
    });

    it('o gerente le a tela inteira, inclusive o que nao pode editar', async () => {
      const admin = await signedInAdmin();

      await patch(admin, {
        banners: [{ imageDesktop: BANNER_IMAGE, title: 'Natal' }],
      }).expect(200);

      const owner = await signedInOwner();
      const response = await adminSettings(owner).expect(200);

      expect(response.body.banners).toHaveLength(1);
      expect(response.body.institutionalPages).toHaveLength(6);
    });

    it.each([
      ['o carrossel da home', { banners: [{ imageDesktop: BANNER_IMAGE }] }],
      [
        'as paginas do rodape',
        { institutionalPages: [{ slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, isActive: true }] },
      ],
      ['as redes sociais', { socialLinks: { instagram: 'maisonessence' } }],
      ['o perfume da vez', { featuredPerfumeProductId: '64b7f1c2a1b2c3d4e5f60718' }],
    ])('recusa o gerente em %s, dizendo o que pedir', async (_campo, body) => {
      const owner = await signedInOwner();

      const response = await patch(owner, body).expect(403);

      expect(String(response.body.message)).toMatch(/administrador altera/);
    });

    it('apagar a escolha do perfume da vez tambem e moldura', async () => {
      const owner = await signedInOwner();

      await patch(owner, { featuredPerfumeProductId: null }).expect(403);
    });

    it('um campo de moldura recusa o corpo inteiro: nada e gravado', async () => {
      const owner = await signedInOwner();

      await patch(owner, {
        storeName: 'Maison Essence Sobral',
        banners: [{ imageDesktop: BANNER_IMAGE }],
      }).expect(403);

      const stored = await settings.findOne({}).lean().exec();

      // Nem o documento nasceu: a recusa vem antes da primeira leitura.
      expect(stored).toBeNull();
    });

    it('o administrador grava os dois lados no mesmo PATCH', async () => {
      const admin = await signedInAdmin();

      const response = await patch(admin, {
        storeName: 'Maison Essence Sobral',
        banners: [{ imageDesktop: BANNER_IMAGE, title: 'Natal' }],
        socialLinks: { instagram: 'maisonessence' },
      }).expect(200);

      expect(response.body).toMatchObject({
        storeName: 'Maison Essence Sobral',
        socialLinks: { instagram: 'maisonessence' },
      });
      expect(response.body.banners).toHaveLength(1);
    });

    it('a recusa nao vira linha de auditoria', async () => {
      const owner = await signedInOwner();

      await patch(owner, { banners: [{ imageDesktop: BANNER_IMAGE }] }).expect(403);

      await expect(audit.countDocuments({ action: 'settings.updated' })).resolves.toBe(0);
    });
  });
});
