import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import type { CloudinaryAsset } from '../src/modules/uploads/cloudinary.service.js';
import { CloudinaryService } from '../src/modules/uploads/cloudinary.service.js';
import { signParams } from '../src/modules/uploads/cloudinary.signature.js';
import {
  Category,
  Product,
  StoreSettings,
  USER_ROLES,
  User,
  type UserRole,
} from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';
/** O mesmo que `test/setup-mongo.ts` poe no ambiente. */
const API_SECRET = 'test-cloudinary-secret';
const PHOTO = 'maison-essence/products/asad-9f3a1c2b';

describe('uploads (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let products: Model<Product>;
  let categories: Model<Category>;
  let settings: Model<StoreSettings>;
  let cloudinary: CloudinaryService;
  let owner: { Authorization: string };
  let staff: { Authorization: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    products = app.get<Model<Product>>(getModelToken(Product.name));
    categories = app.get<Model<Category>>(getModelToken(Category.name));
    settings = app.get<Model<StoreSettings>>(getModelToken(StoreSettings.name));
    cloudinary = app.get(CloudinaryService);

    const passwordHash = await app.get(PasswordService).hash(PASSWORD);

    owner = await signIn(passwordHash, USER_ROLES.OWNER, 'dona@maisonessence.com');
    staff = await signIn(passwordHash, USER_ROLES.STAFF, 'atendente@maisonessence.com');
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all([
      products.deleteMany({}),
      categories.deleteMany({}),
      settings.deleteMany({}),
    ]);
  });

  async function signIn(
    passwordHash: string,
    role: UserRole,
    email: string,
  ): Promise<{ Authorization: string }> {
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

    return { Authorization: `Bearer ${response.body.accessToken}` };
  }

  /**
   * As duas unicas chamadas de rede do modulo, trocadas por dubles.
   *
   * O resto — assinatura, regra de pasta, conferencia de uso — e calculo
   * local e roda de verdade. So a conversa com o Cloudinary e simulada, que e
   * justamente o que nao existe na maquina de teste.
   */
  function stubAccount(asset: Partial<CloudinaryAsset> | null): {
    destroyed: string[];
  } {
    const destroyed: string[] = [];

    vi.spyOn(cloudinary, 'findImage').mockResolvedValue(
      asset === null
        ? null
        : {
            publicId: PHOTO,
            format: 'jpg',
            bytes: 250_000,
            width: 1200,
            height: 1600,
            version: 1,
            ...asset,
          },
    );
    vi.spyOn(cloudinary, 'destroy').mockImplementation(async (publicId: string) => {
      destroyed.push(publicId);

      return true;
    });

    return { destroyed };
  }

  function sign(body: Record<string, unknown>): request.Test {
    return request(server).post(`${API}/admin/uploads/signature`).set(owner).send(body);
  }

  function confirm(body: Record<string, unknown>): request.Test {
    return request(server).post(`${API}/admin/uploads/confirm`).set(owner).send(body);
  }

  function remove(publicId: string): request.Test {
    // O identificador tem barras; o painel manda percent-encoded.
    return request(server)
      .delete(`${API}/admin/uploads/${encodeURIComponent(publicId)}`)
      .set(owner);
  }

  describe('POST /admin/uploads/signature', () => {
    it('exige estar autenticado', async () => {
      await request(server)
        .post(`${API}/admin/uploads/signature`)
        .send({ folder: 'products' })
        .expect(401);
    });

    it('nao e do atendente: quem publica foto da loja responde por ela', async () => {
      await request(server)
        .post(`${API}/admin/uploads/signature`)
        .set(staff)
        .send({ folder: 'products' })
        .expect(403);
    });

    /**
     * O criterio de aceite: o painel sobe a foto sem o arquivo tocar o
     * backend. E o que esta resposta viabiliza — ela e so metadado, e com ela
     * o navegador fala direto com o Cloudinary.
     */
    it('devolve o necessario para o navegador enviar direto ao Cloudinary', async () => {
      const { body } = await sign({ folder: 'products' }).expect(200);

      expect(body).toMatchObject({
        cloudName: 'maison-test',
        apiKey: '123456789012345',
        folder: 'maison-essence/products',
        uploadUrl: 'https://api.cloudinary.com/v1_1/maison-test/image/upload',
        maxBytes: 5 * 1024 * 1024,
        allowedFormats: ['jpg', 'png', 'webp'],
      });
      expect(body.publicId).toMatch(/^maison-essence\/products\//);
      expect(body.signature).toMatch(/^[0-9a-f]{40}$/);
    });

    it('assina a pasta de destino e as restricoes', async () => {
      const { body } = await sign({ folder: 'banners' }).expect(200);

      expect(body.params).toEqual({
        allowed_formats: 'jpg,png,webp',
        public_id: body.publicId,
        timestamp: body.timestamp,
        transformation: 'c_limit,w_2000,h_2000',
      });
      // A pasta vai dentro do `public_id`, entao desviar o arquivo para fora
      // dela exigiria uma assinatura que o painel nao consegue produzir.
      expect(body.publicId).toMatch(/^maison-essence\/banners\//);
      expect(signParams(body.params, API_SECRET)).toBe(body.signature);
    });

    it('vale uma hora, que e o teto do proprio Cloudinary', async () => {
      const { body } = await sign({ folder: 'categories' }).expect(200);
      const validade = Date.parse(body.expiresAt) - body.timestamp * 1000;

      expect(validade).toBe(3600 * 1000);
    });

    it('nunca devolve o segredo da conta', async () => {
      const { text } = await sign({ folder: 'products' }).expect(200);

      expect(text).not.toContain(API_SECRET);
    });

    it('usa o nome do arquivo para o identificador ficar legivel na conta', async () => {
      const { body } = await sign({ folder: 'products', filename: 'Asad Lattafa.jpg' }).expect(
        200,
      );

      expect(body.publicId).toMatch(/^maison-essence\/products\/asad-lattafa-[0-9a-f]{8}$/);
    });

    it('recusa pasta que nao existe', async () => {
      const { body } = await sign({ folder: 'recibos' }).expect(400);

      expect(String(body.message)).toContain('pasta invalida');
    });
  });

  describe('POST /admin/uploads/confirm', () => {
    it('recusa publicId de pasta nao permitida', async () => {
      const { body } = await confirm({ publicId: 'maison-essence/recibos/nota-1' }).expect(422);

      expect(body.message).toContain('pastas da loja');
    });

    it('recusa publicId de outra conta, que e a injecao que isso fecha', async () => {
      await confirm({ publicId: 'conta-alheia/products/asad' }).expect(422);
      await confirm({ publicId: 'https://exemplo.com/foto.jpg' }).expect(422);
    });

    it('recusa identificador que nao existe na conta', async () => {
      stubAccount(null);

      const { body } = await confirm({ publicId: PHOTO }).expect(422);

      expect(body.message).toContain('Envie o arquivo novamente');
    });

    /** Criterio de aceite: a URL do card entrega webp para quem suporta. */
    it('devolve as tres URLs de entrega, com f_auto e a largura do contexto', async () => {
      stubAccount({});

      const { body } = await confirm({ publicId: PHOTO }).expect(200);

      expect(body.urls.card).toBe(
        `https://res.cloudinary.com/maison-test/image/upload/f_auto,q_auto,c_limit,w_600/${PHOTO}`,
      );
      expect(body.urls.thumb).toContain('w_400');
      expect(body.urls.detail).toContain('w_1200');
      expect(body.folder).toBe('products');
    });

    it('responde com os numeros da conta, e nao com os que o painel afirmou', async () => {
      stubAccount({ bytes: 250_000, format: 'jpg' });

      const { body } = await confirm({
        publicId: PHOTO,
        bytes: 1,
        format: 'gif',
      }).expect(200);

      expect(body.bytes).toBe(250_000);
      expect(body.format).toBe('jpg');
    });

    it('recusa acima de 5 MB e apaga o arquivo recusado', async () => {
      const { destroyed } = stubAccount({ bytes: 6 * 1024 * 1024 });

      const { body } = await confirm({ publicId: PHOTO }).expect(422);

      expect(body.message).toContain('o limite e 5,0 MB');
      expect(destroyed).toEqual([PHOTO]);
    });

    it('recusa formato fora da lista e apaga o arquivo recusado', async () => {
      const { destroyed } = stubAccount({ format: 'gif' });

      const { body } = await confirm({ publicId: PHOTO }).expect(422);

      expect(body.message).toContain('Use JPG, PNG ou WebP');
      expect(destroyed).toEqual([PHOTO]);
    });
  });

  describe('DELETE /admin/uploads/:publicId', () => {
    it('apaga a foto que ninguem usa', async () => {
      const { destroyed } = stubAccount({});

      await remove(PHOTO).expect(204);

      expect(destroyed).toEqual([PHOTO]);
    });

    it('recusa apagar foto que um produto ainda usa, dizendo quantos', async () => {
      const { destroyed } = stubAccount({});
      await products.create({
        name: 'Asad Lattafa',
        images: [PHOTO],
        variants: [{ sku: 'ASAD', priceCents: 19_990 }],
      });

      const { body } = await remove(PHOTO).expect(409);

      expect(body.details).toMatchObject({ products: 1, total: 1 });
      expect(body.message).toContain('1 produto');
      expect(destroyed).toEqual([]);
    });

    it('enxerga tambem a foto que esta so na variante', async () => {
      stubAccount({});
      await products.create({
        name: 'Asad Lattafa',
        variants: [{ sku: 'ASAD', priceCents: 19_990, image: PHOTO }],
      });

      const { body } = await remove(PHOTO).expect(409);

      expect(body.details.products).toBe(1);
    });

    it('enxerga a foto da categoria e a do banner', async () => {
      const categoryPhoto = 'maison-essence/categories/perfumes-11aa22bb';
      const bannerPhoto = 'maison-essence/banners/natal-7f0c1d2e';

      stubAccount({});
      await categories.create({ name: 'Perfumes', image: categoryPhoto });
      await settings.create({ banners: [{ imageDesktop: bannerPhoto }] });

      const categoria = await remove(categoryPhoto).expect(409);
      const banner = await remove(bannerPhoto).expect(409);

      expect(categoria.body.details.categories).toBe(1);
      expect(banner.body.details.banners).toBe(1);
    });

    it('recusa apagar identificador que nao e das pastas da loja', async () => {
      const { destroyed } = stubAccount({});

      await remove('conta-alheia/products/asad').expect(422);

      expect(destroyed).toEqual([]);
    });
  });

  describe('vinculacao a um produto', () => {
    /**
     * O confirm sozinho nao fecha a porta: quem grava e a rota de produto, e
     * e la que a regra de pasta precisa valer tambem. Sem isto, bastaria
     * pular o confirm e mandar a URL que se quisesse.
     */
    it('recusa gravar no produto uma imagem que nao veio do upload', async () => {
      const { body } = await request(server)
        .post(`${API}/admin/products`)
        .set(owner)
        .send({
          name: 'Asad Lattafa',
          images: ['https://exemplo.com/foto.jpg'],
          variants: [{ priceCents: 19_990 }],
        })
        .expect(400);

      expect(String(body.message)).toContain('imagem invalida');
    });

    it('aceita o identificador devolvido pelo upload', async () => {
      const { body } = await request(server)
        .post(`${API}/admin/products`)
        .set(owner)
        .send({
          name: 'Asad Lattafa',
          images: [PHOTO],
          variants: [{ priceCents: 19_990, image: PHOTO }],
        })
        .expect(201);

      expect(body.images).toEqual([PHOTO]);
      expect(body.coverImage).toBe(PHOTO);
    });
  });
});
