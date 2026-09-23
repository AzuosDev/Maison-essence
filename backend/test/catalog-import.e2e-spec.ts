import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { CatalogImportService } from '../src/modules/catalog-import/catalog-import.service.js';
import { AuditEntry, Category, Product, USER_ROLES, User, type UserRole } from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

const CATALOG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/database/seeds/data/catalog.json',
);

/**
 * A importacao do catalogo, contra um banco de verdade.
 *
 * Os tres criterios que nao dao para provar com teste de unidade estao aqui,
 * porque os tres sao sobre o que **sobra gravado** depois de duas execucoes:
 *
 * 1. rodar duas vezes cria zero produtos na segunda e nao duplica nada;
 * 2. trocar um preco no arquivo atualiza so o preco, preservando descricao,
 *    fotos e estoque;
 * 3. `--dry-run` nao grava nada e imprime o mesmo relatorio.
 *
 * O `mongodb-memory-server` sobe um `mongod` solto, sem replica set — ou seja,
 * o caminho **sem transacao** e o exercitado aqui. E o pior caso de proposito:
 * e nele que uma importacao pela metade fica gravada, e por isso e nele que a
 * idempotencia precisa estar certa.
 */
describe('catalog import (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let products: Model<Product>;
  let categories: Model<Category>;
  let audit: Model<AuditEntry>;
  let importer: CatalogImportService;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    products = app.get<Model<Product>>(getModelToken(Product.name));
    categories = app.get<Model<Category>>(getModelToken(Category.name));
    audit = app.get<Model<AuditEntry>>(getModelToken(AuditEntry.name));
    importer = app.get(CatalogImportService);
    passwordHash = await app.get(PasswordService).hash(PASSWORD);

    // `autoIndex` so vale em desenvolvimento: sem isto o indice unico de slug
    // nao existe, e o teste de duplicidade passaria por motivo errado.
    await Promise.all([products.createIndexes(), categories.createIndexes()]);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await Promise.all([
      products.deleteMany({}),
      categories.deleteMany({}),
      audit.deleteMany({}),
    ]);
  });

  /* ---- Um catalogo pequeno, escrito a mao ---------------------------------- */

  function catalog(): Record<string, unknown> {
    return {
      $schema: 'maison-essence/catalog@1',
      generatedAt: '2026-09-22',
      currency: 'BRL',
      priceUnit: 'cents',
      notes: ['stock vem 0 em todos os itens'],
      categories: [
        // A filha antes da mae de proposito: o arquivo nao garante ordem, e a
        // importacao e que precisa garantir.
        {
          slug: 'arabes-masculinos',
          name: 'Arabes Masculinos',
          parentSlug: 'perfumes',
          order: 1,
          isActive: true,
        },
        { slug: 'perfumes', name: 'Perfumes', parentSlug: null, order: 1, isActive: true },
      ],
      products: [
        {
          name: 'Khamrah Qahwa',
          slug: 'khamrah-qahwa',
          brand: null,
          description: '',
          categorySlugs: ['arabes-masculinos'],
          images: [],
          tags: [],
          isActive: true,
          isFeatured: false,
          isReadyToShip: false,
          sourceCatalog: 'AM Atacadista - Originais',
          variants: [
            {
              sku: 'ME-0036',
              label: '',
              priceCents: 15_500,
              compareAtPriceCents: null,
              stock: 0,
              allowBackorder: false,
              image: null,
              isActive: true,
            },
          ],
        },
      ],
    };
  }

  async function signIn(role: UserRole, email: string): Promise<{ Authorization: string }> {
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

  /* ---- Criterio 1: rodar duas vezes --------------------------------------- */

  it('importa o catalogo e resolve as categorias para ids de verdade', async () => {
    const report = await importer.import(catalog());

    expect(report.categories).toMatchObject({ created: 2, updated: 0, failed: 0 });
    expect(report.products).toMatchObject({ created: 1, updated: 0, failed: 0 });
    expect(report.variants).toMatchObject({ created: 1, deactivated: 0 });
    expect(report.failures).toEqual([]);

    const child = await categories.findOne({ slug: 'arabes-masculinos' }).exec();
    const root = await categories.findOne({ slug: 'perfumes' }).exec();
    const product = await products.findOne({ slug: 'khamrah-qahwa' }).exec();

    // A filha aponta para a mae mesmo tendo vindo antes dela no arquivo.
    expect(child?.parentId?.toHexString()).toBe(root?._id.toHexString());
    expect(product?.categoryIds.map(String)).toEqual([child?._id.toHexString()]);
    expect(product?.variants[0]?.priceCents).toBe(15_500);
  });

  it('a segunda execucao cria zero e nao duplica nada', async () => {
    await importer.import(catalog());
    const second = await importer.import(catalog());

    expect(second.products.created).toBe(0);
    expect(second.products.updated).toBe(1);
    expect(second.categories.created).toBe(0);
    expect(second.categories.updated).toBe(2);
    expect(second.variants).toMatchObject({ created: 0, deactivated: 0 });

    expect(await products.countDocuments({ slug: 'khamrah-qahwa' })).toBe(1);
    expect(await categories.countDocuments({})).toBe(2);

    const product = await products.findOne({ slug: 'khamrah-qahwa' }).exec();

    expect(product?.variants).toHaveLength(1);
  });

  /* ---- Criterio 2: so o preco muda ---------------------------------------- */

  it('atualiza o preco e preserva descricao, fotos e estoque do painel', async () => {
    await importer.import(catalog());

    // A dona trabalha no painel: escreve a descricao, sobe uma foto, conta o
    // estoque e destaca o produto na home.
    const saved = await products.findOne({ slug: 'khamrah-qahwa' }).exec();
    const variantId = saved?.variants[0]?.id;

    saved?.set({
      description: 'Cafe, canela e baunilha.',
      brand: 'Lattafa',
      images: ['maison-essence/produtos/khamrah-1'],
      isFeatured: true,
    });
    saved?.set({ 'variants.0.stock': 12 });
    await saved?.save();

    // O fornecedor manda a lista nova, com o preco reajustado.
    const next = catalog();
    const [product] = next.products as Record<string, any>[];

    product.variants[0].priceCents = 16_900;

    const report = await importer.import(next);
    const after = await products.findOne({ slug: 'khamrah-qahwa' }).exec();

    expect(report.products).toMatchObject({ created: 0, updated: 1, failed: 0 });
    expect(after?.variants[0]?.priceCents).toBe(16_900);

    // O que a dona escreveu continua inteiro.
    expect(after?.description).toBe('Cafe, canela e baunilha.');
    expect(after?.brand).toBe('Lattafa');
    expect(after?.images).toEqual(['maison-essence/produtos/khamrah-1']);
    expect(after?.variants[0]?.stock).toBe(12);
    expect(after?.isFeatured).toBe(true);

    // E a variante e a mesma: o `_id` e o que os pedidos guardam.
    expect(after?.variants[0]?.id).toBe(variantId);
  });

  /* ---- Criterio 3: --dry-run ---------------------------------------------- */

  it('a simulacao nao grava nada e conta o mesmo que a execucao de verdade', async () => {
    const simulated = await importer.import(catalog(), { dryRun: true });

    expect(simulated.dryRun).toBe(true);
    expect(await products.countDocuments({})).toBe(0);
    expect(await categories.countDocuments({})).toBe(0);

    const real = await importer.import(catalog());

    expect(simulated.categories).toEqual(real.categories);
    expect(simulated.products).toEqual(real.products);
    expect(simulated.variants).toEqual(real.variants);
  });

  it('a simulacao de uma reimportacao tambem confere', async () => {
    await importer.import(catalog());

    const simulated = await importer.import(catalog(), { dryRun: true });

    expect(simulated.products).toMatchObject({ created: 0, updated: 1 });
  });

  /* ---- Variantes ---------------------------------------------------------- */

  it('desativa, sem apagar, a variante que sumiu do arquivo', async () => {
    const withTwo = catalog();
    const [product] = withTwo.products as Record<string, any>[];

    product.variants.push({
      sku: 'ME-0036-25',
      label: '25ml',
      priceCents: 4600,
      compareAtPriceCents: null,
      stock: 0,
      allowBackorder: false,
      image: null,
      isActive: true,
    });

    await importer.import(withTwo);

    const report = await importer.import(catalog());
    const after = await products.findOne({ slug: 'khamrah-qahwa' }).exec();

    expect(report.variants.deactivated).toBe(1);
    // Continua la, apagada da vitrine e viva para o historico do pedido.
    expect(after?.variants).toHaveLength(2);
    expect(after?.variants[1]).toMatchObject({ sku: 'ME-0036-25', isActive: false });
  });

  /* ---- Falhas isoladas ---------------------------------------------------- */

  it('um produto invalido vira linha no relatorio e os outros entram', async () => {
    const broken = catalog();

    (broken.products as Record<string, any>[]).unshift({
      name: 'Produto Quebrado',
      slug: 'produto-quebrado',
      categorySlugs: ['arabes-masculinos'],
      variants: [{ sku: 'ME-9999', priceCents: 'quinze mil' }],
    });

    const report = await importer.import(broken);

    expect(report.products).toMatchObject({ created: 1, failed: 1 });
    expect(report.failures[0]?.slug).toBe('produto-quebrado');
    expect(report.failures[0]?.reason).toContain('centavos');

    // O bom entrou; o quebrado nao.
    expect(await products.countDocuments({ slug: 'khamrah-qahwa' })).toBe(1);
    expect(await products.countDocuments({ slug: 'produto-quebrado' })).toBe(0);
  });

  it('acusa a categoria que nao existe, nomeando qual', async () => {
    const orphan = catalog();
    const [product] = orphan.products as Record<string, any>[];

    product.categorySlugs = ['categoria-que-nao-existe'];

    const report = await importer.import(orphan);

    expect(report.products.failed).toBe(1);
    expect(report.failures[0]?.reason).toContain('categoria-que-nao-existe');
  });

  it('recusa o segundo produto com o mesmo endereco, em vez de sobrescrever', async () => {
    const twice = catalog();
    const [product] = twice.products as Record<string, any>[];

    (twice.products as unknown[]).push({ ...product, name: 'Outro Produto' });

    const report = await importer.import(twice);

    expect(report.products).toMatchObject({ created: 1, failed: 1 });
    expect(await products.countDocuments({ slug: 'khamrah-qahwa' })).toBe(1);

    const saved = await products.findOne({ slug: 'khamrah-qahwa' }).exec();

    expect(saved?.name).toBe('Khamrah Qahwa');
  });

  /* ---- --only -------------------------------------------------------------- */

  it('--only importa um produto so, e as categorias que ele precisa', async () => {
    const two = catalog();

    (two.products as Record<string, any>[]).push({
      ...(two.products as Record<string, any>[])[0],
      name: 'Khamrah',
      slug: 'khamrah',
      variants: [{ sku: 'ME-0035', priceCents: 16_000, stock: 0, isActive: true }],
    });

    const report = await importer.import(two, { only: 'khamrah' });

    expect(report.products).toMatchObject({ created: 1, updated: 0 });
    expect(await products.countDocuments({})).toBe(1);
    // As categorias continuam entrando: sem elas o produto escolhido nao
    // teria onde se encaixar.
    expect(await categories.countDocuments({})).toBe(2);
  });

  /* ---- O arquivo de verdade ------------------------------------------------ */

  it('importa o catalog.json inteiro, duas vezes, sem duplicar', async () => {
    const file: unknown = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));

    const first = await importer.import(file);

    expect(first.failures).toEqual([]);
    expect(first.categories.created).toBe(21);
    expect(first.products.created).toBe(269);
    expect(first.variants.created).toBe(269);

    const second = await importer.import(file);

    expect(second.products).toMatchObject({ created: 0, updated: 269, failed: 0 });
    expect(second.categories).toMatchObject({ created: 0, updated: 21 });
    expect(await products.countDocuments({})).toBe(269);
  }, 120_000);

  /* ---- A rota -------------------------------------------------------------- */

  describe('POST /admin/catalog/import', () => {
    it('so o SUPER_ADMIN entra', async () => {
      const owner = await signIn(USER_ROLES.OWNER, 'dona@maisonessence.com');

      await request(server)
        .post(`${API}/admin/catalog/import`)
        .set(owner)
        .send(catalog())
        .expect(403);

      await request(server).post(`${API}/admin/catalog/import`).send(catalog()).expect(401);
    });

    it('aceita o arquivo colado inteiro, com $schema e metadados', async () => {
      // Sem o parser proprio da rota o `$schema` bateria no guard de
      // operadores do Mongo e a resposta seria 400 antes de qualquer coisa.
      const root = await signIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      const response = await request(server)
        .post(`${API}/admin/catalog/import`)
        .set(root)
        .send(catalog())
        .expect(200);

      expect(response.body.products).toMatchObject({ created: 1, failed: 0 });
      expect(await products.countDocuments({})).toBe(1);
    });

    it('simula pela rota, que e quem nao tem terminal para conferir depois', async () => {
      const root = await signIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      const response = await request(server)
        .post(`${API}/admin/catalog/import?dryRun=true`)
        .set(root)
        .send(catalog())
        .expect(200);

      expect(response.body.dryRun).toBe(true);
      expect(response.body.products.created).toBe(1);
      expect(await products.countDocuments({})).toBe(0);
    });

    it('recusa o corpo que nao tem as duas listas', async () => {
      const root = await signIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .post(`${API}/admin/catalog/import`)
        .set(root)
        .send({ products: [] })
        .expect(400);
    });

    it('aceita um corpo maior que o teto de 256 KB do resto da API', async () => {
      // O parser proprio da rota e o que faz isto passar: com o teto geral, um
      // catalogo que crescesse alem de 256 KB seria recusado com 413 e a dona
      // nao teria como importar a lista do fornecedor.
      const root = await signIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const big = catalog();
      const [product] = big.products as Record<string, any>[];

      // Setenta produtos com a descricao no limite do schema: um catalogo
      // grande de verdade, montado com valores que a API aceita.
      big.products = Array.from({ length: 70 }, (_unused, index) => ({
        ...product,
        name: `Perfume ${index}`,
        slug: `perfume-${index}`,
        description: 'a'.repeat(4900),
        variants: [{ ...product.variants[0], sku: `ME-${index}` }],
      }));

      expect(JSON.stringify(big).length).toBeGreaterThan(300_000);

      const response = await request(server)
        .post(`${API}/admin/catalog/import`)
        .set(root)
        .send(big)
        .expect(200);

      expect(response.body.products).toMatchObject({ created: 70, failed: 0 });
    });

    it('recusa um corpo acima de 1 MB', async () => {
      const root = await signIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');
      const huge = catalog();

      huge.notes = [Array.from({ length: 40 }, () => 'x'.repeat(30_000)).join('')];

      await request(server)
        .post(`${API}/admin/catalog/import`)
        .set(root)
        .send(huge)
        .expect(413);
    });

    it('deixa na trilha quem importou o catalogo', async () => {
      const root = await signIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .post(`${API}/admin/catalog/import`)
        .set(root)
        .send(catalog())
        .expect(200);

      const entry = await audit.findOne({ action: 'catalog.imported' }).exec();

      expect(entry?.actorEmail).toBe('root@maisonessence.com');
      expect(entry?.details).toMatchObject({ products: { created: 1 } });
    });

    it('a simulacao nao entra na trilha: nada aconteceu', async () => {
      const root = await signIn(USER_ROLES.SUPER_ADMIN, 'root@maisonessence.com');

      await request(server)
        .post(`${API}/admin/catalog/import?dryRun=true`)
        .set(root)
        .send(catalog())
        .expect(200);

      expect(await audit.countDocuments({ action: 'catalog.imported' })).toBe(0);
    });
  });
});
