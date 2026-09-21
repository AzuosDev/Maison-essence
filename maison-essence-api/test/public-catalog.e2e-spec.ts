import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import {
  Category,
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  Order,
  PAYMENT_METHODS,
  Product,
  QuantityDiscount,
  type OrderStatus,
} from '../src/schemas.js';

const API = '/api/v1';

/** Ids das categorias semeadas, para os testes montarem os filtros. */
interface Seeded {
  perfumes: Types.ObjectId;
  masculinos: Types.ObjectId;
  velas: Types.ObjectId;
}

describe('catalogo publico (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let products: Model<Product>;
  let categories: Model<Category>;
  let discounts: Model<QuantityDiscount>;
  let orders: Model<Order>;
  let seeded: Seeded;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    products = app.get<Model<Product>>(getModelToken(Product.name));
    categories = app.get<Model<Category>>(getModelToken(Category.name));
    discounts = app.get<Model<QuantityDiscount>>(getModelToken(QuantityDiscount.name));
    orders = app.get<Model<Order>>(getModelToken(Order.name));

    // `autoIndex` so vale em desenvolvimento: sem isso a busca por relevancia
    // nao acha o indice de texto. Em producao quem os cria e o seed.
    await products.createIndexes();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    seeded = await seedCatalog();
  });

  afterEach(async () => {
    await Promise.all([
      products.deleteMany({}),
      categories.deleteMany({}),
      discounts.deleteMany({}),
      orders.deleteMany({}),
    ]);
  });

  /**
   * A loja de teste: uma categoria principal com uma subcategoria, tres
   * produtos a venda e um desativado.
   */
  async function seedCatalog(): Promise<Seeded> {
    const perfumes = await categories.create({
      name: 'Perfumes',
      slug: 'perfumes',
      previousSlugs: ['perfumaria'],
    });
    const masculinos = await categories.create({
      name: 'Masculinos',
      slug: 'masculinos',
      parentId: perfumes._id,
    });
    const velas = await categories.create({ name: 'Velas', slug: 'velas' });

    await products.create({
      name: 'Asad Lattafa',
      slug: 'asad-lattafa',
      description: 'Amadeirado intenso, com notas de baunilha.',
      brand: 'Lattafa',
      categoryIds: [masculinos._id],
      images: ['maison-essence/products/asad-9f3a1c2b'],
      variants: [{ sku: 'ASAD-100', label: '100 ml', priceCents: 19_990, stock: 5 }],
      isFeatured: true,
      isReadyToShip: true,
    });
    await products.create({
      name: 'Qaed Al Fursan',
      slug: 'qaed-al-fursan',
      brand: 'Lattafa',
      categoryIds: [masculinos._id],
      variants: [
        { sku: 'QAED-90', label: '90 ml', priceCents: 29_990, compareAtPriceCents: 39_990 },
      ],
    });
    await products.create({
      name: 'Vela Aromatica Lavanda',
      slug: 'vela-lavanda',
      brand: 'Maison',
      categoryIds: [velas._id],
      variants: [{ sku: 'VELA-01', priceCents: 4990, stock: 3 }],
    });
    await products.create({
      name: 'Perfume Fora de Linha',
      slug: 'fora-de-linha',
      brand: 'Lattafa',
      categoryIds: [masculinos._id],
      variants: [{ sku: 'FORA-01', priceCents: 9990, stock: 9 }],
      isActive: false,
      isFeatured: true,
      isReadyToShip: true,
    });

    return { perfumes: perfumes._id, masculinos: masculinos._id, velas: velas._id };
  }

  function list(query = ''): request.Test {
    return request(server).get(`${API}/products${query}`);
  }

  function slugsOf(body: { items: { slug: string }[] }): string[] {
    return body.items.map((item) => item.slug);
  }

  async function placeOrder(
    productId: Types.ObjectId,
    quantity: number,
    status: OrderStatus,
  ): Promise<void> {
    const product = await products.findById(productId).exec();
    const variant = product!.variants[0];

    await orders.create({
      items: [
        {
          productId,
          variantId: new Types.ObjectId(variant.id),
          productName: product!.name,
          unitPriceCents: variant.priceCents,
          quantity,
          lineTotalCents: variant.priceCents * quantity,
        },
      ],
      customer: { name: 'Cliente', phone: '85999990000' },
      fulfillment: { mode: FULFILLMENT_MODES.DELIVERY },
      payment: { method: PAYMENT_METHODS.PIX },
      totals: { subtotalCents: 1000, totalCents: 1000 },
      status,
    });
  }

  describe('GET /products', () => {
    it('abre sem token e devolve a pagina no formato da loja', async () => {
      const { body } = await list().expect(200);

      expect(body).toMatchObject({ page: 1, totalItems: 3, totalPages: 1, hasMore: false });
      expect(body.items).toHaveLength(3);
    });

    it('manda a CDN guardar a resposta e o navegador revalidar', async () => {
      const response = await list().expect(200);

      expect(response.headers['cache-control']).toBe(
        'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      );
    });

    it('nao poe cabecalho de cache em resposta de erro', async () => {
      const response = await list('?category=nao-existe').expect(404);

      expect(response.headers['cache-control']).toBeUndefined();
    });

    /** Criterio de aceite: buscar por uma marca ordena por relevancia. */
    it('busca por marca e traz o mais relevante primeiro', async () => {
      const { body } = await list('?q=Lattafa').expect(200);

      expect(slugsOf(body)).toEqual(['asad-lattafa', 'qaed-al-fursan']);
    });

    it('cai no regex quando o termo e curto demais para o indice de texto', async () => {
      // `la` nao e palavra inteira em lugar nenhum: so o regex acha "Vela".
      const { body } = await list('?q=la').expect(200);

      expect(slugsOf(body)).toContain('vela-lavanda');
    });

    /**
     * Criterio de aceite: categoria, faixa de preco e estoque juntos. O Qaed
     * esta na faixa mas esgotado, a vela tem estoque mas e de outra
     * categoria, e o fora de linha esta desativado.
     */
    it('combina categoria, faixa de preco e estoque', async () => {
      const { body } = await list(
        '?category=perfumes&minPrice=10000&maxPrice=50000&inStock=true',
      ).expect(200);

      expect(slugsOf(body)).toEqual(['asad-lattafa']);
    });

    it('a categoria principal traz os produtos das subcategorias', async () => {
      const { body } = await list('?category=perfumes').expect(200);

      expect(slugsOf(body).sort()).toEqual(['asad-lattafa', 'qaed-al-fursan']);
    });

    it('filtra pela subcategoria direto', async () => {
      const { body } = await list('?category=velas').expect(200);

      expect(slugsOf(body)).toEqual(['vela-lavanda']);
    });

    it('endereco antigo de categoria continua filtrando', async () => {
      const { body } = await list('?category=perfumaria').expect(200);

      expect(body.totalItems).toBe(2);
    });

    it('categoria que nao existe e 404, e nao uma lista vazia', async () => {
      await list('?category=nao-existe').expect(404);
    });

    it('filtra por marca sem depender de maiuscula', async () => {
      const { body } = await list('?brand=lattafa').expect(200);

      expect(body.totalItems).toBe(2);
    });

    it('filtra destaques e pronta entrega', async () => {
      const { body: destaques } = await list('?featured=true').expect(200);
      const { body: prontos } = await list('?readyToShip=true').expect(200);

      expect(slugsOf(destaques)).toEqual(['asad-lattafa']);
      expect(slugsOf(prontos)).toEqual(['asad-lattafa']);
    });

    it('ordena por preco, do menor para o maior e ao contrario', async () => {
      const { body: subindo } = await list('?sort=price_asc').expect(200);
      const { body: descendo } = await list('?sort=price_desc').expect(200);

      expect(slugsOf(subindo)).toEqual(['vela-lavanda', 'asad-lattafa', 'qaed-al-fursan']);
      expect(slugsOf(descendo)).toEqual(['qaed-al-fursan', 'asad-lattafa', 'vela-lavanda']);
    });

    /**
     * Ordenar pelo campo cru colocaria este produto no lugar da variante
     * aposentada de R$ 9,90 — um preco que ninguem pode pagar.
     */
    it('ordena por preco ignorando a variante desativada', async () => {
      await products.create({
        name: 'Khamrah',
        slug: 'khamrah',
        brand: 'Lattafa',
        variants: [
          { sku: 'KHA-100', priceCents: 24_990, stock: 2 },
          { sku: 'KHA-10', priceCents: 990, stock: 0, isActive: false },
        ],
      });

      const { body } = await list('?sort=price_asc').expect(200);

      expect(slugsOf(body)).toEqual([
        'vela-lavanda',
        'asad-lattafa',
        'khamrah',
        'qaed-al-fursan',
      ]);
    });

    it('ordena por desconto', async () => {
      const { body } = await list('?sort=discount').expect(200);

      // So o Qaed tem preco riscado; o resto empata em zero.
      expect(slugsOf(body)[0]).toBe('qaed-al-fursan');
    });

    it('ordena por nome respeitando o acento', async () => {
      await products.create({
        name: 'Ambar Nobre',
        slug: 'ambar-nobre',
        brand: 'Maison',
        variants: [{ sku: 'AMB-01', priceCents: 15_990, stock: 1 }],
      });
      await products.updateOne({ slug: 'ambar-nobre' }, { $set: { name: 'Âmbar Nobre' } }).exec();

      const { body } = await list('?sort=name').expect(200);

      // Sem collation, `Â` cairia depois de `V` na ordem de bytes.
      expect(slugsOf(body)[0]).toBe('ambar-nobre');
    });

    it('pagina, e a pagina seguinte nao repete a anterior', async () => {
      const { body: primeira } = await list('?limit=2&sort=price_asc').expect(200);
      const { body: segunda } = await list('?page=2&limit=2&sort=price_asc').expect(200);

      expect(primeira).toMatchObject({ totalItems: 3, totalPages: 2, hasMore: true });
      expect(segunda).toMatchObject({ page: 2, hasMore: false });
      expect(slugsOf(segunda)).not.toContain(slugsOf(primeira)[0]);
    });

    it('recusa pagina maior que o teto da vitrine', async () => {
      await list('?limit=49').expect(400);
    });

    it('recusa ordenacao que nao existe', async () => {
      await list('?sort=barato').expect(400);
    });

    it('nao deixa vazar sku nem campo de gestao', async () => {
      const { body } = await list().expect(200);
      const [card] = body.items;

      expect(card.variants[0].sku).toBeUndefined();
      expect(card.variants[0].allowBackorder).toBeUndefined();
      expect(card.isActive).toBeUndefined();
      expect(card.description).toBeUndefined();
    });

    it('nao lista produto sem nenhuma variante a venda', async () => {
      await products.updateOne(
        { slug: 'vela-lavanda' },
        { $set: { 'variants.0.isActive': false } },
      ).exec();

      const { body } = await list().expect(200);

      expect(slugsOf(body)).not.toContain('vela-lavanda');
    });
  });

  describe('produto desativado', () => {
    /** Criterio de aceite: nao aparece em rota publica nenhuma. */
    it('some da listagem, das prateleiras e do proprio endereco', async () => {
      await placeOrder(
        (await products.findOne({ slug: 'fora-de-linha' }).exec())!._id,
        10,
        ORDER_STATUSES.DELIVERED,
      );

      const [lista, destaques, prontos, vendidos] = await Promise.all([
        list().expect(200),
        request(server).get(`${API}/products/featured`).expect(200),
        request(server).get(`${API}/products/ready-to-ship`).expect(200),
        request(server).get(`${API}/products/best-sellers`).expect(200),
      ]);

      expect(slugsOf(lista.body)).not.toContain('fora-de-linha');
      expect(destaques.body.map((item: { slug: string }) => item.slug)).toEqual([
        'asad-lattafa',
      ]);
      expect(prontos.body).toHaveLength(1);
      expect(vendidos.body).toEqual([]);
      await request(server).get(`${API}/products/fora-de-linha`).expect(404);
    });
  });

  describe('prateleiras da home', () => {
    it('destaques e pronta entrega devolvem o que a dona marcou', async () => {
      const destaques = await request(server).get(`${API}/products/featured`).expect(200);
      const prontos = await request(server).get(`${API}/products/ready-to-ship`).expect(200);

      expect(destaques.body).toHaveLength(1);
      expect(prontos.body[0].slug).toBe('asad-lattafa');
    });

    it('a rota de nome fixo nao e confundida com um slug', async () => {
      await products.create({
        name: 'Featured',
        slug: 'featured',
        brand: 'Maison',
        variants: [{ sku: 'FEAT-01', priceCents: 1000, stock: 1 }],
      });

      const { body } = await request(server).get(`${API}/products/featured`).expect(200);

      expect(Array.isArray(body)).toBe(true);
    });

    it('mais vendidos soma as unidades dos pedidos que viraram venda', async () => {
      const asad = (await products.findOne({ slug: 'asad-lattafa' }).exec())!._id;
      const vela = (await products.findOne({ slug: 'vela-lavanda' }).exec())!._id;

      await placeOrder(vela, 2, ORDER_STATUSES.CONFIRMED);
      await placeOrder(asad, 3, ORDER_STATUSES.DELIVERED);
      await placeOrder(asad, 4, ORDER_STATUSES.SHIPPED);

      const { body } = await request(server).get(`${API}/products/best-sellers`).expect(200);

      expect(body.map((item: { slug: string }) => item.slug)).toEqual([
        'asad-lattafa',
        'vela-lavanda',
      ]);
    });

    /** Pedido que ainda nao virou conversa no WhatsApp nao e venda. */
    it('nao conta pedido pendente nem cancelado', async () => {
      const vela = (await products.findOne({ slug: 'vela-lavanda' }).exec())!._id;

      await placeOrder(vela, 50, ORDER_STATUSES.PENDING_CONTACT);
      await placeOrder(vela, 50, ORDER_STATUSES.CANCELLED);

      const { body } = await request(server).get(`${API}/products/best-sellers`).expect(200);

      expect(body).toEqual([]);
    });

    it('respeita o limite pedido', async () => {
      const { body } = await request(server)
        .get(`${API}/products/ready-to-ship?limit=1`)
        .expect(200);

      expect(body).toHaveLength(1);
    });
  });

  describe('GET /products/:slug', () => {
    it('devolve o produto completo com categorias e relacionados', async () => {
      const { body } = await request(server).get(`${API}/products/asad-lattafa`).expect(200);

      expect(body).toMatchObject({
        slug: 'asad-lattafa',
        description: 'Amadeirado intenso, com notas de baunilha.',
        brand: 'Lattafa',
      });
      expect(body.categories).toEqual([
        { id: seeded.masculinos.toHexString(), name: 'Masculinos', slug: 'masculinos' },
      ]);
      expect(body.related.map((item: { slug: string }) => item.slug)).toEqual([
        'qaed-al-fursan',
      ]);
    });

    it('nao devolve variante desativada nem o preco dela', async () => {
      await products.updateOne(
        { slug: 'asad-lattafa' },
        {
          $push: {
            variants: { sku: 'ASAD-50', label: '50 ml', priceCents: 990, isActive: false },
          },
        },
      ).exec();

      const { body } = await request(server).get(`${API}/products/asad-lattafa`).expect(200);

      expect(body.variants).toHaveLength(1);
      expect(body.priceRangeCents.min).toBe(19_990);
    });

    it('nao traz o proprio produto nem os desativados entre os relacionados', async () => {
      const { body } = await request(server).get(`${API}/products/qaed-al-fursan`).expect(200);
      const slugs = body.related.map((item: { slug: string }) => item.slug);

      expect(slugs).not.toContain('qaed-al-fursan');
      expect(slugs).not.toContain('fora-de-linha');
    });

    it('nao traz relacionado de outra categoria', async () => {
      const { body } = await request(server).get(`${API}/products/vela-lavanda`).expect(200);

      expect(body.related).toEqual([]);
    });

    it('limita os relacionados a oito', async () => {
      for (let index = 0; index < 10; index += 1) {
        await products.create({
          name: `Vizinho ${index}`,
          slug: `vizinho-${index}`,
          brand: 'Lattafa',
          categoryIds: [seeded.masculinos],
          variants: [{ sku: `VIZ-${index}`, priceCents: 10_000, stock: 1 }],
        });
      }

      const { body } = await request(server).get(`${API}/products/asad-lattafa`).expect(200);

      expect(body.related).toHaveLength(8);
    });

    it('produto que ficou sem variante a venda responde 404', async () => {
      await products.updateOne(
        { slug: 'vela-lavanda' },
        { $set: { 'variants.0.isActive': false } },
      ).exec();

      await request(server).get(`${API}/products/vela-lavanda`).expect(404);
    });

    it('endereco que nao existe responde 404', async () => {
      await request(server).get(`${API}/products/nao-existe`).expect(404);
    });
  });

  describe('desconto por quantidade', () => {
    it('anuncia no card a regra do proprio produto', async () => {
      const asad = (await products.findOne({ slug: 'asad-lattafa' }).exec())!._id;

      await discounts.create({ productId: asad, minQty: 3, percentOff: 10 });

      const { body } = await list('?q=Asad').expect(200);

      expect(body.items[0].quantityDiscount).toEqual({ minQty: 3, percentOff: 10 });
    });

    it('anuncia tambem a regra da categoria', async () => {
      await discounts.create({ categoryId: seeded.velas, minQty: 2, percentOff: 5 });

      const { body } = await list('?category=velas').expect(200);

      expect(body.items[0].quantityDiscount).toEqual({ minQty: 2, percentOff: 5 });
    });

    it('na mesma quantidade vence o maior desconto, sem somar', async () => {
      const asad = (await products.findOne({ slug: 'asad-lattafa' }).exec())!._id;

      await discounts.create({ productId: asad, minQty: 3, percentOff: 10 });
      await discounts.create({ categoryId: seeded.masculinos, minQty: 3, percentOff: 15 });

      const { body } = await request(server).get(`${API}/products/asad-lattafa`).expect(200);

      expect(body.quantityDiscount).toEqual({ minQty: 3, percentOff: 15 });
    });

    it('a pagina do produto recebe a escada inteira', async () => {
      const asad = (await products.findOne({ slug: 'asad-lattafa' }).exec())!._id;

      await discounts.create({ productId: asad, minQty: 3, percentOff: 10 });
      await discounts.create({ productId: asad, minQty: 6, percentOff: 20 });

      const { body } = await request(server).get(`${API}/products/asad-lattafa`).expect(200);

      expect(body.quantityDiscounts).toEqual([
        { minQty: 3, percentOff: 10 },
        { minQty: 6, percentOff: 20 },
      ]);
      expect(body.quantityDiscount).toEqual({ minQty: 3, percentOff: 10 });
    });

    it('regra desativada nao vale', async () => {
      const asad = (await products.findOne({ slug: 'asad-lattafa' }).exec())!._id;

      await discounts.create({ productId: asad, minQty: 3, percentOff: 10, isActive: false });

      const { body } = await request(server).get(`${API}/products/asad-lattafa`).expect(200);

      expect(body.quantityDiscount).toBeNull();
      expect(body.quantityDiscounts).toEqual([]);
    });

    it('produto sem regra nenhuma vem com null', async () => {
      const { body } = await list().expect(200);

      expect(body.items.every((item: { quantityDiscount: unknown }) => item.quantityDiscount === null)).toBe(
        true,
      );
    });
  });

  describe('menu da loja', () => {
    it('as categorias publicas tambem sao cacheadas pela CDN', async () => {
      const response = await request(server).get(`${API}/categories`).expect(200);

      expect(response.headers['cache-control']).toContain('s-maxage=60');
    });
  });
});
