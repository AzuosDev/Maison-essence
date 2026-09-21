import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import { Category, Product, USER_ROLES, User, type UserRole } from '../src/schemas.js';

const API = '/api/v1';
const PASSWORD = 'senha-longa-do-painel-2026';

describe('categories (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let users: Model<User>;
  let categories: Model<Category>;
  let products: Model<Product>;
  let passwordHash: string;
  let owner: { Authorization: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    users = app.get<Model<User>>(getModelToken(User.name));
    categories = app.get<Model<Category>>(getModelToken(Category.name));
    products = app.get<Model<Product>>(getModelToken(Product.name));
    passwordHash = await app.get(PasswordService).hash(PASSWORD);

    owner = await signIn(USER_ROLES.OWNER, 'dona@maisonessence.com');
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await Promise.all([categories.deleteMany({}), products.deleteMany({})]);
  });

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

  /** Cria a categoria pela rota do painel, que e como a dona a criaria. */
  async function create(body: Record<string, unknown>): Promise<Record<string, any>> {
    const response = await request(server)
      .post(`${API}/admin/categories`)
      .set(owner)
      .send(body)
      .expect(201);

    return response.body;
  }

  /**
   * Produto direto no model: o modulo de produtos ainda nao existe, e o que
   * importa aqui e so o vinculo com a categoria.
   */
  async function createProduct(
    categoryIds: string[],
    overrides: Partial<Product> = {},
  ): Promise<void> {
    await products.create({
      name: 'Asad Lattafa',
      categoryIds: categoryIds as unknown as Types.ObjectId[],
      variants: [{ sku: 'ASAD-100', label: '100ml', priceCents: 19990, stock: 3 }],
      isActive: true,
      ...overrides,
    });
  }

  describe('POST /admin/categories', () => {
    it('gera o slug a partir do nome', async () => {
      const created = await create({ name: 'Perfumes Arabes' });

      expect(created).toMatchObject({
        name: 'Perfumes Arabes',
        slug: 'perfumes-arabes',
        parentId: null,
        order: 0,
        isActive: true,
        productCount: 0,
        previousSlugs: [],
      });
    });

    it('aceita slug escrito a mao, normalizado', async () => {
      const created = await create({ name: 'Casa e Aromas', slug: 'Velas Aromaticas' });

      expect(created.slug).toBe('velas-aromaticas');
    });

    it('recusa com 409 o slug ja usado por outra categoria', async () => {
      await create({ name: 'Perfumes Arabes' });

      await request(server)
        .post(`${API}/admin/categories`)
        .set(owner)
        .send({ name: 'Outra', slug: 'perfumes-arabes' })
        .expect(409);
    });

    it('cria subcategoria de uma categoria principal', async () => {
      const parent = await create({ name: 'Perfumes' });
      const child = await create({ name: 'Arabes', parentId: parent.id });

      expect(child.parentId).toBe(parent.id);
    });

    it('recusa subcategoria de subcategoria', async () => {
      const parent = await create({ name: 'Perfumes' });
      const child = await create({ name: 'Arabes', parentId: parent.id });

      const response = await request(server)
        .post(`${API}/admin/categories`)
        .set(owner)
        .send({ name: 'Lattafa', parentId: child.id })
        .expect(422);

      expect(response.body.message).toMatch(/subcategoria nao pode ter filhos/);
    });

    it('exige papel que gerencia a loja', async () => {
      const staff = await signIn(USER_ROLES.STAFF, 'staff@maisonessence.com');

      await request(server)
        .post(`${API}/admin/categories`)
        .set(staff)
        .send({ name: 'Perfumes' })
        .expect(403);

      // Ler o catalogo, porem, o STAFF pode.
      await request(server).get(`${API}/admin/categories`).set(staff).expect(200);
    });
  });

  describe('PATCH /admin/categories/:id', () => {
    it('guarda o endereco antigo ao trocar o slug', async () => {
      const created = await create({ name: 'Perfumes Arabes' });

      const response = await request(server)
        .patch(`${API}/admin/categories/${created.id}`)
        .set(owner)
        .send({ slug: 'arabes' })
        .expect(200);

      expect(response.body.slug).toBe('arabes');
      expect(response.body.previousSlugs).toEqual(['perfumes-arabes']);
    });

    it('nao deixa a categoria com filhos virar subcategoria', async () => {
      const parent = await create({ name: 'Perfumes' });
      await create({ name: 'Arabes', parentId: parent.id });
      const outra = await create({ name: 'Casa' });

      await request(server)
        .patch(`${API}/admin/categories/${parent.id}`)
        .set(owner)
        .send({ parentId: outra.id })
        .expect(422);
    });

    it('promove a subcategoria a categoria principal com parentId nulo', async () => {
      const parent = await create({ name: 'Perfumes' });
      const child = await create({ name: 'Arabes', parentId: parent.id });

      const response = await request(server)
        .patch(`${API}/admin/categories/${child.id}`)
        .set(owner)
        .send({ parentId: null })
        .expect(200);

      expect(response.body.parentId).toBeNull();
    });
  });

  describe('PATCH /admin/categories/reorder', () => {
    it('grava a posicao pela ordem da lista recebida', async () => {
      const casa = await create({ name: 'Casa' });
      const perfumes = await create({ name: 'Perfumes' });
      const velas = await create({ name: 'Velas' });

      const response = await request(server)
        .patch(`${API}/admin/categories/reorder`)
        .set(owner)
        .send({ ids: [velas.id, perfumes.id, casa.id] })
        .expect(200);

      expect(response.body.map((item: { name: string }) => item.name)).toEqual([
        'Velas',
        'Perfumes',
        'Casa',
      ]);
      expect(response.body.map((item: { order: number }) => item.order)).toEqual([0, 1, 2]);
    });

    it('recusa lista que cita categoria inexistente', async () => {
      const casa = await create({ name: 'Casa' });

      await request(server)
        .patch(`${API}/admin/categories/reorder`)
        .set(owner)
        .send({ ids: [casa.id, '64b7f1c2a1b2c3d4e5f60718'] })
        .expect(422);
    });
  });

  describe('DELETE /admin/categories/:id', () => {
    it('exclui categoria vazia', async () => {
      const created = await create({ name: 'Perfumes' });

      await request(server)
        .delete(`${API}/admin/categories/${created.id}`)
        .set(owner)
        .expect(204);

      expect(await categories.countDocuments()).toBe(0);
    });

    it('responde 409 com a contagem de produtos vinculados', async () => {
      const created = await create({ name: 'Perfumes' });
      await createProduct([created.id]);
      await createProduct([created.id], { name: 'Yara Lattafa' });
      // Inativo nao entra na conta: ele nao trava a exclusao.
      await createProduct([created.id], { name: 'Antigo', isActive: false });

      const response = await request(server)
        .delete(`${API}/admin/categories/${created.id}`)
        .set(owner)
        .expect(409);

      expect(response.body.details).toMatchObject({ productCount: 2, canDeactivate: true });
      expect(response.body.message).toContain('2 produtos ativos');
      expect(await categories.countDocuments()).toBe(1);
    });

    it('responde 409 quando a categoria tem subcategorias', async () => {
      const parent = await create({ name: 'Perfumes' });
      await create({ name: 'Arabes', parentId: parent.id });

      const response = await request(server)
        .delete(`${API}/admin/categories/${parent.id}`)
        .set(owner)
        .expect(409);

      expect(response.body.details).toMatchObject({ subcategoryCount: 1 });
    });

    it('solta a referencia dos produtos inativos ao excluir', async () => {
      const created = await create({ name: 'Perfumes' });
      await createProduct([created.id], { isActive: false });

      await request(server)
        .delete(`${API}/admin/categories/${created.id}`)
        .set(owner)
        .expect(204);

      const orphan = await products.findOne().exec();

      expect(orphan?.categoryIds).toEqual([]);
    });
  });

  describe('GET /categories', () => {
    it('devolve os pais com os filhos aninhados, ordenados por order', async () => {
      const casa = await create({ name: 'Casa', order: 1 });
      const perfumes = await create({ name: 'Perfumes', order: 0 });
      await create({ name: 'Importados', parentId: perfumes.id, order: 1 });
      await create({ name: 'Arabes', parentId: perfumes.id, order: 0 });

      const response = await request(server).get(`${API}/categories`).expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Perfumes');
      expect(response.body[0].children.map((child: { name: string }) => child.name)).toEqual([
        'Arabes',
        'Importados',
      ]);
      expect(response.body[1]).toMatchObject({ id: casa.id, children: [] });
    });

    it('esconde a categoria inativa e o galho embaixo dela', async () => {
      const perfumes = await create({ name: 'Perfumes' });
      await create({ name: 'Arabes', parentId: perfumes.id });
      await create({ name: 'Casa', isActive: false });

      await request(server)
        .patch(`${API}/admin/categories/${perfumes.id}`)
        .set(owner)
        .send({ isActive: false })
        .expect(200);

      const response = await request(server).get(`${API}/categories`).expect(200);

      expect(response.body).toEqual([]);
    });

    it('conta os produtos ativos, somando no pai os da subcategoria', async () => {
      const perfumes = await create({ name: 'Perfumes' });
      const arabes = await create({ name: 'Arabes', parentId: perfumes.id });

      await createProduct([perfumes.id]);
      await createProduct([arabes.id], { name: 'Yara Lattafa' });
      await createProduct([arabes.id], { name: 'Esgotado', isActive: false });

      const response = await request(server).get(`${API}/categories`).expect(200);

      expect(response.body[0].productCount).toBe(2);
      expect(response.body[0].children[0].productCount).toBe(1);
    });
  });

  describe('GET /categories/:slug', () => {
    it('devolve a categoria com as subcategorias ativas', async () => {
      const perfumes = await create({ name: 'Perfumes' });
      await create({ name: 'Arabes', parentId: perfumes.id });
      await createProduct([perfumes.id]);

      const response = await request(server).get(`${API}/categories/perfumes`).expect(200);

      expect(response.body).toMatchObject({ slug: 'perfumes', productCount: 1 });
      expect(response.body.children).toHaveLength(1);
      // O historico de renomeacoes e assunto do painel, nao da vitrine.
      expect(response.body).not.toHaveProperty('previousSlugs');
    });

    it('responde 301 para o endereco antigo, com Location para o atual', async () => {
      const created = await create({ name: 'Perfumes Arabes' });

      await request(server)
        .patch(`${API}/admin/categories/${created.id}`)
        .set(owner)
        .send({ slug: 'arabes' })
        .expect(200);

      const response = await request(server)
        .get(`${API}/categories/perfumes-arabes`)
        .redirects(0)
        .expect(301);

      expect(response.headers.location).toBe(`${API}/categories/arabes`);
      expect(response.body).toMatchObject({ slug: 'arabes' });
    });

    it('responde 404 para categoria inativa e para slug desconhecido', async () => {
      await create({ name: 'Casa', isActive: false });

      await request(server).get(`${API}/categories/casa`).expect(404);
      await request(server).get(`${API}/categories/nao-existe`).expect(404);
    });

    it('dispensa autenticacao', async () => {
      await create({ name: 'Perfumes' });

      await request(server).get(`${API}/categories/perfumes`).expect(200);
    });
  });
});
