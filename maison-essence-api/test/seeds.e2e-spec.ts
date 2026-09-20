import { ConfigService } from '@nestjs/config';
import type { INestApplicationContext } from '@nestjs/common';
import type { Connection } from 'mongoose';
import mongoose from 'mongoose';
import {
  BOOTSTRAP_ORIGINS,
  BOOTSTRAP_OUTCOMES,
  BootstrapService,
} from '../src/modules/auth/bootstrap.service.js';
import {
  Category,
  CategorySchema,
  DeliveryCity,
  DeliveryCitySchema,
  PaymentSettings,
  type PaymentSettingsModel,
  PaymentSettingsSchema,
  Product,
  ProductSchema,
  StoreSettings,
  type StoreSettingsModel,
  StoreSettingsSchema,
  USER_ROLES,
  User,
  UserSchema,
} from '../src/schemas.js';
import { DemoSeedRefusedError, DemoSeedService } from '../src/seeds/demo-seed.service.js';
import { runSeed } from '../src/seeds/seed-runner.js';

/**
 * Os seeds rodam pelo `runSeed`, o mesmo caminho dos comandos de `npm run`:
 * cada chamada sobe o contexto do Nest, confere os indices e fecha a conexao.
 *
 * As leituras de verificacao usam uma conexao propria, aberta a parte, para
 * nao depender do contexto que o seed acabou de fechar.
 */
describe('seeds (e2e)', () => {
  let connection: Connection;
  let models: ReturnType<typeof buildModels>;

  function buildModels(db: Connection) {
    return {
      users: db.model(User.name, UserSchema),
      categories: db.model(Category.name, CategorySchema),
      products: db.model(Product.name, ProductSchema),
      cities: db.model(DeliveryCity.name, DeliveryCitySchema),
      storeSettings: db.model<StoreSettings, StoreSettingsModel>(
        StoreSettings.name,
        StoreSettingsSchema,
      ),
      paymentSettings: db.model<PaymentSettings, PaymentSettingsModel>(
        PaymentSettings.name,
        PaymentSettingsSchema,
      ),
    };
  }

  beforeAll(async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI ausente: o setup do mongodb-memory-server nao rodou');
    }

    connection = mongoose.createConnection(uri, { dbName: process.env.MONGODB_DB_NAME });
    await connection.asPromise();
    models = buildModels(connection);
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    await connection.dropDatabase();
  });

  /** Roda uma tarefa pelo runner de verdade e devolve o que ela produziu. */
  async function seed<T>(task: (app: INestApplicationContext) => Promise<T>): Promise<T> {
    let result: T | undefined;
    let failure: unknown;

    await runSeed('seeds (e2e)', async (app) => {
      try {
        result = await task(app);
      } catch (error: unknown) {
        failure = error;
        throw error;
      }
    });

    // O runner marca falha no proprio processo, o que faria o vitest sair com
    // codigo 1 mesmo passando. Quem afere a falha e o teste.
    process.exitCode = 0;

    if (failure) {
      throw failure;
    }

    return result as T;
  }

  function bootstrapSuperAdmin() {
    return seed((app) =>
      app
        .get(BootstrapService)
        .run({ origin: BOOTSTRAP_ORIGINS.CLI, requireEmptyDatabase: false }),
    );
  }

  describe('seed:superadmin', () => {
    it('cria o primeiro SUPER_ADMIN com senha temporaria', async () => {
      const result = await bootstrapSuperAdmin();

      expect(result.outcome).toBe(BOOTSTRAP_OUTCOMES.CREATED);

      const created = await models.users
        .findOne({ email: process.env.BOOTSTRAP_SUPERADMIN_EMAIL })
        .select('+passwordHash')
        .exec();

      expect(created).toMatchObject({
        role: USER_ROLES.SUPER_ADMIN,
        isActive: true,
        mustChangePassword: true,
      });
      expect(created?.passwordHash.startsWith('$argon2id$')).toBe(true);
    });

    it('rodar duas vezes nao cria dois super-admins', async () => {
      await bootstrapSuperAdmin();

      const second = await bootstrapSuperAdmin();

      expect(second.outcome).toBe(BOOTSTRAP_OUTCOMES.ALREADY_BOOTSTRAPPED);
      expect(await models.users.countDocuments({ role: USER_ROLES.SUPER_ADMIN })).toBe(1);
    });

    it('cria os indices do banco, que fora de desenvolvimento nao nascem sozinhos', async () => {
      await bootstrapSuperAdmin();

      const indexes = await models.users.collection.indexes();
      const email = indexes.find((index) => index.name === 'email_1');

      expect(email?.unique).toBe(true);
    });
  });

  describe('seed:demo', () => {
    function runDemo(force = false) {
      return seed((app) => app.get(DemoSeedService).run({ force }));
    }

    it('popula catalogo, entrega e configuracoes', async () => {
      const summary = await runDemo();

      expect(summary).toEqual({
        categories: { created: 3, updated: 0 },
        products: { created: 6, updated: 0 },
        cities: { created: 2, updated: 0 },
      });

      const settings = await models.storeSettings.findOne({}).exec();
      const payment = await models.paymentSettings.findOne({}).exec();

      expect(settings?.storeName).toBe('Maison Essence');
      expect(settings?.institutionalPages).toHaveLength(3);
      expect(payment?.acceptsPix).toBe(true);
      expect(await models.cities.countDocuments({ isActive: true })).toBe(2);
    });

    it('o catalogo publico devolve os produtos, com categoria e preco', async () => {
      await runDemo();

      // A mesma consulta que a listagem publica faz: ativos, do mais novo
      // para o mais velho.
      const catalog = await models.products
        .find({ isActive: true })
        .sort({ createdAt: -1 })
        .populate<{ categoryIds: { slug: string }[] }>('categoryIds', 'slug')
        .exec();

      expect(catalog).toHaveLength(6);
      expect(catalog.every((product) => product.variants.length > 0)).toBe(true);
      expect(catalog.every((product) => product.categoryIds.length > 0)).toBe(true);

      const asad = catalog.find((product) => product.slug === 'asad');

      expect(asad?.categoryIds[0].slug).toBe('perfumes-arabes');
      expect(asad?.variants[0]).toMatchObject({ sku: 'ASAD-100', priceCents: 24_990 });
      // Busca textual do catalogo publico.
      expect(await models.products.countDocuments({ $text: { $search: 'lattafa' } })).toBe(3);
    });

    it('rodar duas vezes atualiza em vez de duplicar', async () => {
      await runDemo();

      const summary = await runDemo();

      expect(summary).toEqual({
        categories: { created: 0, updated: 3 },
        products: { created: 0, updated: 6 },
        cities: { created: 0, updated: 2 },
      });
      expect(await models.products.countDocuments({})).toBe(6);
      expect(await models.categories.countDocuments({})).toBe(3);
      expect(await models.storeSettings.countDocuments({})).toBe(1);
    });

    it('nao roda em producao sem --force', async () => {
      await expect(
        seed(async (app) => {
          // NODE_ENV e lido no momento da chamada; o resto do ambiente do
          // teste continua de pe.
          const config = app.get(ConfigService);
          const original = config.get.bind(config);

          vi.spyOn(config, 'get').mockImplementation((key: string, options?: unknown) =>
            key === 'NODE_ENV' ? 'production' : original(key, options as never),
          );

          return app.get(DemoSeedService).run({ force: false });
        }),
      ).rejects.toBeInstanceOf(DemoSeedRefusedError);

      expect(await models.products.countDocuments({})).toBe(0);
    });
  });

  it('os dois seeds convivem: o painel tem dono e a loja tem catalogo', async () => {
    await bootstrapSuperAdmin();
    await seed((app) => app.get(DemoSeedService).run({ force: false }));

    expect(await models.users.countDocuments({ role: USER_ROLES.SUPER_ADMIN })).toBe(1);
    expect(await models.products.countDocuments({ isActive: true })).toBe(6);
  });
});
