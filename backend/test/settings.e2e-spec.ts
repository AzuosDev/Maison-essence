import { INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import {
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

  /** A dona da loja, que e quem o painel de configuracoes atende. */
  function signedInOwner(): Promise<Session> {
    return signedIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
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

    it('lista as cinco paginas mesmo antes de alguem escreve-las', async () => {
      const owner = await signedInOwner();

      const response = await adminSettings(owner).expect(200);
      const pages = response.body.institutionalPages as {
        slug: string;
        isActive: boolean;
      }[];

      expect(pages.map((page) => page.slug)).toEqual([
        INSTITUTIONAL_PAGE_SLUGS.ABOUT,
        INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY,
        INSTITUTIONAL_PAGE_SLUGS.RETURNS,
        INSTITUTIONAL_PAGE_SLUGS.FAQ,
        INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
      ]);
      // Nascem despublicadas: link de rodape que abre em branco e pior que a
      // ausencia do link.
      expect(pages.every((page) => !page.isActive)).toBe(true);
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
      const owner = await signedInOwner();

      const response = await patch(owner, {
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
      const owner = await signedInOwner();

      await patch(owner, {
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
      const response = await patch(owner, {
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
      const logged = vi.spyOn(Logger.prototype, 'log');

      await patch(owner, {
        whatsappNumber: '5588999999999',
        pickupAddress: { city: 'Sobral' },
      }).expect(200);

      const entry = logged.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.includes('settings.updated'));

      logged.mockRestore();

      expect(entry).toBeDefined();
      expect(JSON.parse(entry as string)).toMatchObject({
        action: 'settings.updated',
        actor: { id: owner.id, email: 'dona@maisonessence.com', role: USER_ROLES.OWNER },
        changes: {
          whatsappNumber: { from: '', to: '5588999999999' },
          'pickupAddress.city': { from: '', to: 'Sobral' },
        },
      });
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
      const owner = await signedInOwner();

      const response = await patch(owner, {
        banners: [
          { imageDesktop: BANNER_IMAGE, title: 'Segundo', order: 2 },
          { imageDesktop: BANNER_IMAGE_MOBILE, title: 'Primeiro', order: 1 },
        ],
      }).expect(200);

      const banners = response.body.banners as { id: string; title: string }[];

      expect(banners.map((banner) => banner.title)).toEqual(['Primeiro', 'Segundo']);
      expect(banners[0].id).toMatch(/^[0-9a-f]{24}$/);
    });

    it('preserva o id do banner entre gravacoes', async () => {
      const owner = await signedInOwner();

      const created = await patch(owner, {
        banners: [{ imageDesktop: BANNER_IMAGE, title: 'Natal' }],
      }).expect(200);
      const { id } = created.body.banners[0];

      const updated = await patch(owner, {
        banners: [{ id, imageDesktop: BANNER_IMAGE, title: 'Natal 2026' }],
      }).expect(200);

      expect(updated.body.banners[0].id).toBe(id);
      expect(updated.body.banners[0].title).toBe('Natal 2026');
    });

    it('recusa periodo que termina antes de comecar', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        banners: [{ imageDesktop: BANNER_IMAGE, startsAt: PAST_END, endsAt: PAST_START }],
      }).expect(422);

      expect(String(response.body.message)).toMatch(/termina antes de comecar/);

      // Nada foi gravado: o carrossel continua vazio.
      const stored = await settings.findOne({}).lean().exec();

      expect(stored?.banners ?? []).toHaveLength(0);
    });

    it('recusa id de banner que nao existe mais', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        banners: [{ id: '000000000000000000000000', imageDesktop: BANNER_IMAGE }],
      }).expect(422);

      expect(response.body.details).toEqual({ unknownIds: ['000000000000000000000000'] });
    });

    it('recusa imagem de fora das pastas da loja', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        banners: [{ imageDesktop: 'https://exemplo.com/banner.png' }],
      }).expect(400);

      expect(String(response.body.message)).toMatch(/imagem invalida/);
    });
  });

  describe('GET /settings (publica)', () => {
    it('dispensa autenticacao e entrega so o subconjunto seguro', async () => {
      const owner = await signedInOwner();

      await patch(owner, {
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
      const owner = await signedInOwner();

      const painel = await patch(owner, {
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
      const owner = await signedInOwner();

      await patch(owner, { banners: [{ imageDesktop: BANNER_IMAGE }] }).expect(200);

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

    async function publishAbout(owner: Session): Promise<void> {
      await patch(owner, {
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

    it('lista so as publicadas, com titulo e endereco', async () => {
      const owner = await signedInOwner();

      await publishAbout(owner);

      const response = await request(server).get(`${API}/pages`).expect(200);

      expect(response.body).toEqual([
        { slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, title: 'Quem somos' },
      ]);
    });

    it('entrega o markdown como foi escrito', async () => {
      const owner = await signedInOwner();

      await publishAbout(owner);

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
      const owner = await signedInOwner();

      await publishAbout(owner);
      await patch(owner, {
        institutionalPages: [{ slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, isActive: false }],
      }).expect(200);

      const response = await request(server)
        .get(`${API}/pages/${INSTITUTIONAL_PAGE_SLUGS.ABOUT}`)
        .expect(404);

      expect(response.body.message).toMatch(/nao encontrada/);
    });

    it('responde 404 para endereco que nao e de pagina nenhuma', async () => {
      await request(server).get(`${API}/pages/promocoes`).expect(404);
    });

    it('recusa no painel um slug fora da lista fixa', async () => {
      const owner = await signedInOwner();

      const response = await patch(owner, {
        institutionalPages: [{ slug: 'promocoes', title: 'Promocoes' }],
      }).expect(400);

      expect(String(response.body.message)).toMatch(/pagina desconhecida/);
    });
  });
});
