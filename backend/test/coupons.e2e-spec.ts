import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { PasswordService } from '../src/modules/auth/password.service.js';
import {
  COUPON_EXHAUSTED_WARNING,
  COUPON_EXPIRED_WARNING,
  COUPON_NOT_FOR_ITEMS_WARNING,
  COUPON_UNKNOWN_WARNING,
} from '../src/modules/coupons/coupons.constants.js';
import {
  Coupon,
  DeliveryCity,
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  Order,
  PAYMENT_METHODS,
  PaymentSettings,
  Product,
  RateLimitHit,
  StoreSettings,
  USER_ROLES,
  User,
} from '../src/schemas.js';

const API = '/api/v1';
const QUOTE = `${API}/cart/quote`;
const ORDERS = `${API}/orders`;
const ADMIN_ORDERS = `${API}/admin/orders`;
const ADMIN_COUPONS = `${API}/admin/coupons`;
const CAMPAIGNS = `${API}/campaigns`;
const PRODUCTS = `${API}/products`;
const PASSWORD = 'senha-longa-do-painel-2026';

/** A loja de teste, em centavos. */
const PRICE_PERFUME = 19_990;
const PRICE_CANDLE = 4_500;
const CITY_FEE = 1_500;
const PIX_PERCENT = 5;

const IP = '203.0.113.20';

interface Seeded {
  perfumeId: string;
  perfumeVariantId: string;
  candleId: string;
  candleVariantId: string;
  cityId: string;
}

/**
 * Cupons, de ponta a ponta.
 *
 * O que estes casos protegem e a conta que a cliente vê e o número que a dona
 * confere no painel. Eles atravessam a mecânica inteira — cotação, pedido,
 * "Vendido", cancelamento, faixa da home — porque o cupom e a primeira coisa
 * nesta loja que liga as três telas: um desconto resolvido na sacola, congelado
 * no pedido e contado quando a venda fecha.
 */
describe('cupons (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let products: Model<Product>;
  let cities: Model<DeliveryCity>;
  let payments: Model<PaymentSettings>;
  let store: Model<StoreSettings>;
  let orders: Model<Order>;
  let coupons: Model<Coupon>;
  let hits: Model<RateLimitHit>;
  let users: Model<User>;
  let seeded: Seeded;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer();
    products = app.get<Model<Product>>(getModelToken(Product.name));
    cities = app.get<Model<DeliveryCity>>(getModelToken(DeliveryCity.name));
    payments = app.get<Model<PaymentSettings>>(getModelToken(PaymentSettings.name));
    store = app.get<Model<StoreSettings>>(getModelToken(StoreSettings.name));
    orders = app.get<Model<Order>>(getModelToken(Order.name));
    coupons = app.get<Model<Coupon>>(getModelToken(Coupon.name));
    hits = app.get<Model<RateLimitHit>>(getModelToken(RateLimitHit.name));
    users = app.get<Model<User>>(getModelToken(User.name));
    // `autoIndex` só esta ligado em desenvolvimento, e sem o único de `code`
    // o cupom repetido seria aceito e o 409 não teria de onde vir.
    await coupons.createIndexes();
    token = await signIn();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    seeded = await seedStore();
  });

  afterEach(async () => {
    await Promise.all([
      products.deleteMany({}),
      cities.deleteMany({}),
      payments.deleteMany({}),
      store.deleteMany({}),
      orders.deleteMany({}),
      coupons.deleteMany({}),
      hits.deleteMany({}),
    ]);
  });

  /* ---- A conta ---------------------------------------------------------- */

  describe('a cotação', () => {
    it('não cita cupom nenhum quando ninguém digitou código', async () => {
      const { body: quote } = await quoteCart().expect(200);

      expect(quote.coupon).toBeNull();
      expect(quote.couponDiscountCents).toBe(0);
      expect(quote.warnings).toEqual([]);
    });

    /**
     * O cupom de produtos específicos alcança só as linhas deles.
     *
     * Sacola de R$ 199,90 em perfume mais R$ 45,00 em vela, com um cupom de 20%
     * que aponta o perfume: desconta R$ 39,98, e não R$ 48,98.
     */
    it('desconta só os produtos do cupom', async () => {
      await createCoupon({ code: 'PERFUME20', percentOff: 20, productIds: [seeded.perfumeId] });

      const { body: quote } = await quoteCart({
        items: [perfumeLine(), candleLine()],
        couponCode: 'PERFUME20',
      }).expect(200);

      expect(quote.subtotalCents).toBe(PRICE_PERFUME + PRICE_CANDLE);
      expect(quote.coupon.code).toBe('PERFUME20');
      expect(quote.coupon.eligibleSubtotalCents).toBe(PRICE_PERFUME);
      expect(quote.coupon.wholeStore).toBe(false);
      expect(quote.couponDiscountCents).toBe(3_998);
    });

    it('alcança a sacola inteira quando o cupom não escolhe produtos', async () => {
      await createCoupon({ code: 'TUDO10', percentOff: 10 });

      const { body: quote } = await quoteCart({
        items: [perfumeLine(), candleLine()],
        couponCode: 'TUDO10',
      }).expect(200);

      expect(quote.coupon.wholeStore).toBe(true);
      expect(quote.couponDiscountCents).toBe(2_449);
    });

    /** Desconto em reais maior que a sacola tira só o que há. */
    it('não deixa o desconto em reais passar da sacola', async () => {
      await createCoupon({ code: 'VALE100', amountOffCents: 10_000, percentOff: null });

      const { body: quote } = await quoteCart({
        items: [candleLine()],
        couponCode: 'VALE100',
      }).expect(200);

      expect(quote.couponDiscountCents).toBe(PRICE_CANDLE);
      expect(quote.totalCents).toBe(CITY_FEE);
    });

    /**
     * O desconto do PIX incide sobre o que sobrou do cupom.
     *
     * Dois percentuais sobre o mesmo valor cheio tirariam mais do que a loja
     * prometeu, e a diferença apareceria como um pedido que não fecha com o que
     * a tela mostrou.
     */
    it('cobra o PIX sobre o subtotal já descontado', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20 });

      const { body: quote } = await quoteCart({
        items: [{ ...perfumeLine(), quantity: 2 }],
        payment: { method: PAYMENT_METHODS.PIX, installments: 1 },
        couponCode: 'TUDO20',
      }).expect(200);

      const payable = PRICE_PERFUME * 2 - 7_996;

      expect(quote.couponDiscountCents).toBe(7_996);
      expect(quote.pixDiscountCents).toBe(Math.round((payable * PIX_PERCENT) / 100));
      expect(quote.totalCents).toBe(payable - quote.pixDiscountCents + CITY_FEE);
    });

    /**
     * O frete grátis continua medindo o subtotal cheio dos produtos.
     *
     * Quem comprou R$ 399,80 alcançou a isenção na prateleira, e um cupom de 20%
     * não pode tirar dela um frete que ela já tinha conquistado. O mínimo deste
     * caso fica entre os dois números de propósito: com a régua errada, a taxa
     * voltaria.
     */
    it('não deixa o cupom custar o frete grátis', async () => {
      await store.updateOne({}, { $set: { freeShippingMinCents: 35_000 } }).exec();
      await createCoupon({ code: 'TUDO20', percentOff: 20 });

      const { body: quote } = await quoteCart({
        items: [{ ...perfumeLine(), quantity: 2 }],
        couponCode: 'TUDO20',
      }).expect(200);

      expect(quote.subtotalCents).toBe(39_980);
      expect(quote.couponDiscountCents).toBe(7_996);
      expect(quote.deliveryFeeCents).toBe(0);
    });

    /**
     * O que os produtos custam depois dos descontos, sem a entrega.
     *
     * E o número que o fechamento mostra como total enquanto a cliente não
     * escolheu entrega ou retirada — nessa altura a taxa que volta na resposta
     * e de uma cidade que ninguém escolheu. Sem este campo, a tela exibiria o
     * subtotal cheio embaixo de uma linha de cupom, numa soma que não fecha; e
     * subtrair no navegador seria a única conta de dinheiro feita lá.
     */
    it('separa o que os produtos custam do que a entrega acrescenta', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20 });

      const { body: quote } = await quoteCart({ couponCode: 'TUDO20' }).expect(200);

      expect(quote.payableCents).toBe(PRICE_PERFUME - quote.couponDiscountCents);
      expect(quote.totalCents).toBe(quote.payableCents + CITY_FEE);
    });

    /** No PIX ele também já esta descontado: e o total menos a entrega, sempre. */
    it('conta o desconto do PIX dentro do que os produtos custam', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20 });

      const { body: quote } = await quoteCart({
        payment: { method: PAYMENT_METHODS.PIX, installments: 1 },
        couponCode: 'TUDO20',
      }).expect(200);

      expect(quote.pixDiscountCents).toBeGreaterThan(0);
      expect(quote.payableCents).toBe(
        PRICE_PERFUME - quote.couponDiscountCents - quote.pixDiscountCents,
      );
      expect(quote.totalCents).toBe(quote.payableCents + CITY_FEE);
    });

    it('aceita o código em minúsculas e com espaco', async () => {
      await createCoupon({ code: 'TUDO10', percentOff: 10 });

      const { body: quote } = await quoteCart({ couponCode: '  tudo10 ' }).expect(200);

      expect(quote.coupon.code).toBe('TUDO10');
    });
  });

  /* ---- As recusas ------------------------------------------------------- */

  describe('o código que não pega', () => {
    /**
     * Nenhuma recusa derruba a cotação.
     *
     * Quem esta com a sacola montada e um código velho merece ver o total dos
     * itens, não um erro que apaga a tela.
     */
    it('avisa e mantem o total quando o código não existe', async () => {
      const { body: quote } = await quoteCart({ couponCode: 'NAOEXISTE' }).expect(200);

      expect(quote.coupon).toBeNull();
      expect(quote.couponDiscountCents).toBe(0);
      expect(quote.totalCents).toBe(PRICE_PERFUME + CITY_FEE);
      expect(quote.couponWarning).toBe(COUPON_UNKNOWN_WARNING);
    });

    it('avisa que o cupom venceu', async () => {
      await createCoupon({
        code: 'ONTEM',
        percentOff: 20,
        endsAt: new Date(Date.now() - 60_000),
      });

      const { body: quote } = await quoteCart({ couponCode: 'ONTEM' }).expect(200);

      expect(quote.couponWarning).toBe(COUPON_EXPIRED_WARNING);
    });

    /**
     * Campanha agendada responde como código inexistente, e não como "ainda
     * não começou": distinguir contaria ao visitante o que a loja guardou para
     * dezembro.
     */
    it('esconde a campanha que ainda não começou', async () => {
      await createCoupon({
        code: 'DEZEMBRO',
        percentOff: 20,
        startsAt: new Date(Date.now() + 86_400_000),
      });

      const { body: quote } = await quoteCart({ couponCode: 'DEZEMBRO' }).expect(200);

      expect(quote.couponWarning).toBe(COUPON_UNKNOWN_WARNING);
    });

    it('esconde a campanha desligada', async () => {
      await createCoupon({ code: 'PAUSADA', percentOff: 20, isActive: false });

      const { body: quote } = await quoteCart({ couponCode: 'PAUSADA' }).expect(200);

      expect(quote.couponWarning).toBe(COUPON_UNKNOWN_WARNING);
    });

    it('avisa quando o cupom não vale para os itens da sacola', async () => {
      await createCoupon({ code: 'SOVELA', percentOff: 20, productIds: [seeded.candleId] });

      const { body: quote } = await quoteCart({ couponCode: 'SOVELA' }).expect(200);

      expect(quote.coupon).toBeNull();
      expect(quote.couponWarning).toBe(COUPON_NOT_FOR_ITEMS_WARNING);
    });
  });

  /* ---- O teto de usos --------------------------------------------------- */

  describe('o teto de usos', () => {
    /**
     * O pedido em Processando ocupa vaga.
     *
     * O contador oficial só sobe no "Vendido" — e o que a dona pediu —, mas um
     * cupom de um uso com dois pedidos pendentes já prometeu dois descontos.
     * Sem contar o pendente, o teto seria decorativo.
     */
    it('esgota o cupom com um pedido ainda em processamento', async () => {
      await createCoupon({ code: 'UNICO', percentOff: 20, maxUses: 1 });

      await place({ couponCode: 'UNICO' });

      const { body: quote } = await quoteCart({ couponCode: 'UNICO' }).expect(200);

      expect(quote.coupon).toBeNull();
      expect(quote.couponWarning).toBe(COUPON_EXHAUSTED_WARNING);
      expect(await usedCountOf('UNICO')).toBe(0);
    });

    /** Cancelar devolve a vaga na hora, sem rotina de limpeza nenhuma. */
    it('devolve a vaga quando o pedido pendente e cancelado', async () => {
      await createCoupon({ code: 'UNICO', percentOff: 20, maxUses: 1 });

      const { body: order } = await place({ couponCode: 'UNICO' });

      await setStatus(order.orderId, ORDER_STATUSES.CANCELLED).expect(200);

      const { body: quote } = await quoteCart({ couponCode: 'UNICO' }).expect(200);

      expect(quote.coupon.code).toBe('UNICO');
    });

    it('mostra na régua do painel o que foi vendido e o que esta segurando', async () => {
      const couponId = await createCoupon({ code: 'CINCO', percentOff: 20, maxUses: 5 });

      await place({ couponCode: 'CINCO' });

      const { body: view } = await request(server)
        .get(`${ADMIN_COUPONS}/${couponId}`)
        .set(as())
        .expect(200);

      expect(view).toMatchObject({
        usedCount: 0,
        holdingCount: 1,
        remainingUses: 4,
        status: 'live',
      });
    });
  });

  /* ---- O pedido --------------------------------------------------------- */

  describe('o pedido', () => {
    it('congela o cupom e o desconto no documento', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20 });

      const { body: created } = await place({ couponCode: 'TUDO20' });
      const order = await orders.findById(created.orderId).exec();

      expect(order?.coupon).toMatchObject({
        code: 'TUDO20',
        title: 'Campanha de teste',
        discountLabel: '20% OFF',
        discountCents: 3_998,
      });
      expect(order?.totals.couponDiscountCents).toBe(3_998);
      expect(order?.couponConsumedAt).toBeNull();
    });

    it('escreve o cupom na mensagem que chega no WhatsApp da dona', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20 });

      const { body: created } = await place({ couponCode: 'TUDO20' });
      const order = await orders.findById(created.orderId).exec();

      expect(order?.whatsappMessage).toContain('Cupom TUDO20 (20% OFF): -R$ 39,98');
    });

    /**
     * Cupom que morre entre a cotação e o pedido não vira desconto em silêncio.
     *
     * O 409 e a conferência de `assertQuoteHolds`: o total que a cliente viu não
     * e mais o total de agora, e quem decide se ainda quer comprar e quem ia
     * pagar.
     */
    it('recusa o pedido quando o cupom venceu depois da cotação', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20 });

      const payload = body({ couponCode: 'TUDO20' });
      const { body: quote } = await request(server).post(QUOTE).send(payload).expect(200);

      await coupons.updateOne({ code: 'TUDO20' }, { $set: { isActive: false } }).exec();

      await request(server)
        .post(ORDERS)
        .set('x-forwarded-for', IP)
        .send({ ...payload, expectedTotalCents: quote.totalCents })
        .expect(409);
    });
  });

  /* ---- O contador ------------------------------------------------------- */

  describe('o "Vendido"', () => {
    it('conta o uso quando a dona marca o pedido como vendido', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20, maxUses: 5 });

      const { body: created } = await place({ couponCode: 'TUDO20' });

      await setStatus(created.orderId, ORDER_STATUSES.CONFIRMED).expect(200);

      expect(await usedCountOf('TUDO20')).toBe(1);
      expect((await orders.findById(created.orderId).exec())?.couponConsumedAt).not.toBeNull();
    });

    /**
     * Ir e voltar entre Entregue e Vendido a tarde inteira conta uma vez só.
     *
     * Quem reivindica o direito de contar e o próprio pedido, pelo marcador — a
     * mesma mecânica do estoque devolvido no cancelamento.
     */
    it('não conta duas vezes o mesmo pedido', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20, maxUses: 5 });

      const { body: created } = await place({ couponCode: 'TUDO20' });

      await setStatus(created.orderId, ORDER_STATUSES.CONFIRMED).expect(200);
      await setStatus(created.orderId, ORDER_STATUSES.DELIVERED).expect(200);
      await setStatus(created.orderId, ORDER_STATUSES.CONFIRMED).expect(200);

      expect(await usedCountOf('TUDO20')).toBe(1);
    });

    it('devolve o uso quando a venda fechada e cancelada', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20, maxUses: 5 });

      const { body: created } = await place({ couponCode: 'TUDO20' });

      await setStatus(created.orderId, ORDER_STATUSES.CONFIRMED).expect(200);
      await setStatus(created.orderId, ORDER_STATUSES.CANCELLED).expect(200);

      expect(await usedCountOf('TUDO20')).toBe(0);
      expect((await orders.findById(created.orderId).exec())?.couponConsumedAt).toBeNull();
    });

    /** Logística não e venda: nem "saiu para entrega" nem "entregue" contam. */
    it('não conta no caminho até a entrega', async () => {
      await createCoupon({ code: 'TUDO20', percentOff: 20, maxUses: 5 });

      const { body: created } = await place({ couponCode: 'TUDO20' });

      await setStatus(created.orderId, ORDER_STATUSES.SHIPPED).expect(200);
      await setStatus(created.orderId, ORDER_STATUSES.DELIVERED).expect(200);

      expect(await usedCountOf('TUDO20')).toBe(0);
    });
  });

  /* ---- A campanha na loja ----------------------------------------------- */

  describe('a campanha', () => {
    it('não anuncia nada na home sem campanha no ar', async () => {
      await createCoupon({ code: 'SILENCIOSO', percentOff: 20, showOnHome: false });

      const { body } = await request(server).get(`${CAMPAIGNS}/live`).expect(200);

      expect(body.campaign).toBeNull();
    });

    /** Entre duas no ar, a home anuncia a que acaba primeiro. */
    it('anuncia a campanha que acaba primeiro', async () => {
      await createCoupon({
        code: 'DEZEMBRO',
        title: 'Natal',
        percentOff: 10,
        showOnHome: true,
        endsAt: new Date('2099-12-25T00:00:00.000Z'),
      });
      await createCoupon({
        code: 'BLACKFRIDAY',
        title: 'Black Friday',
        percentOff: 20,
        showOnHome: true,
        endsAt: new Date(Date.now() + 3_600_000),
      });

      const { body } = await request(server).get(`${CAMPAIGNS}/live`).expect(200);

      expect(body.campaign).toMatchObject({
        code: 'BLACKFRIDAY',
        title: 'Black Friday',
        slug: 'black-friday',
        discountLabel: '20% OFF',
      });
    });

    /** A escassez só aparece quando e verdade e quando aperta. */
    it('conta os cupons restantes só quando são poucos', async () => {
      await createCoupon({
        code: 'POUCOS',
        title: 'Quase no fim',
        percentOff: 20,
        maxUses: 3,
        showOnHome: true,
      });

      const { body: poucos } = await request(server).get(`${CAMPAIGNS}/live`).expect(200);

      expect(poucos.campaign.scarcityLabel).toBe('Restam 3 cupons');

      await coupons.updateOne({ code: 'POUCOS' }, { $set: { maxUses: 500 } }).exec();

      const { body: muitos } = await request(server).get(`${CAMPAIGNS}/live`).expect(200);

      expect(muitos.campaign.scarcityLabel).toBe('');
    });

    /**
     * Campanha esgotada não sobe para a home.
     *
     * Ela esta no prazo e ligada — "no ar", pela regra da janela —, mas o
     * código dela já não passa no fechamento. Anunciar o que vai ser recusado
     * e o pior momento que esta feature produz, e a vaga da home vai para a
     * campanha seguinte.
     */
    it('não anuncia a campanha que esgotou, e passa a vaga para a próxima', async () => {
      await createCoupon({
        code: 'ESGOTADA',
        title: 'Esgotada',
        percentOff: 30,
        maxUses: 1,
        usedCount: 1,
        showOnHome: true,
        endsAt: new Date(Date.now() + 3_600_000),
      });
      await createCoupon({
        code: 'SOBRANDO',
        title: 'Ainda tem',
        percentOff: 10,
        maxUses: 50,
        showOnHome: true,
        endsAt: new Date(Date.now() + 7_200_000),
      });

      const { body } = await request(server).get(`${CAMPAIGNS}/live`).expect(200);

      expect(body.campaign).toMatchObject({ code: 'SOBRANDO', discountLabel: '10% OFF' });
    });

    /** Esgotada sozinha deixa a home calada, e não com uma promessa falsa. */
    it('cala a home quando a única campanha anunciável esgotou', async () => {
      await createCoupon({
        code: 'ESGOTADA',
        percentOff: 30,
        maxUses: 2,
        usedCount: 2,
        showOnHome: true,
      });

      const { body } = await request(server).get(`${CAMPAIGNS}/live`).expect(200);

      expect(body.campaign).toBeNull();
    });

    /**
     * Pedido aberto também tira a campanha do ar.
     *
     * O `usedCount` ainda e zero — ninguém marcou "Vendido" —, e mesmo assim a
     * vaga do único cupom já esta comprometida. A home que continuasse
     * anunciando mandaria a segunda cliente digitar um código que a cotação
     * recusa.
     */
    it('não anuncia a campanha cuja última vaga esta num pedido aberto', async () => {
      await createCoupon({
        code: 'UNICO',
        percentOff: 20,
        maxUses: 1,
        showOnHome: true,
      });

      await place({ couponCode: 'UNICO' });

      const { body } = await request(server).get(`${CAMPAIGNS}/live`).expect(200);

      expect(body.campaign).toBeNull();
    });

    it('abre a página da campanha pelo endereço dela', async () => {
      await createCoupon({ code: 'BLACKFRIDAY', title: 'Black Friday', percentOff: 20 });

      const { body } = await request(server).get(`${CAMPAIGNS}/black-friday`).expect(200);

      expect(body.code).toBe('BLACKFRIDAY');
    });

    /** Link de story que ficou circulando depois do fim não abre promoção. */
    it('recusa a página de uma campanha encerrada', async () => {
      await createCoupon({
        code: 'ONTEM',
        title: 'Black Friday',
        percentOff: 20,
        endsAt: new Date(Date.now() - 60_000),
      });

      await request(server).get(`${CAMPAIGNS}/black-friday`).expect(404);
    });

    it('filtra a vitrine pelos produtos da campanha', async () => {
      await createCoupon({
        code: 'SOPERFUME',
        title: 'Black Friday',
        percentOff: 20,
        productIds: [seeded.perfumeId],
      });

      const { body } = await request(server)
        .get(PRODUCTS)
        .query({ campaign: 'black-friday' })
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(body.items[0].slug).toBe('asad');
    });

    /**
     * Campanha fora do ar devolve vitrine vazia, e não o catálogo inteiro.
     *
     * A alternativa seria um link velho anunciando a loja toda como se
     * estivesse em promoção.
     */
    it('devolve vitrine vazia para campanha que não esta no ar', async () => {
      await createCoupon({
        code: 'ONTEM',
        title: 'Black Friday',
        percentOff: 20,
        productIds: [seeded.perfumeId],
        endsAt: new Date(Date.now() - 60_000),
      });

      const { body } = await request(server)
        .get(PRODUCTS)
        .query({ campaign: 'black-friday' })
        .expect(200);

      expect(body.items).toHaveLength(0);
    });
  });

  /* ---- O painel --------------------------------------------------------- */

  describe('o painel', () => {
    it('cadastra um cupom e devolve a régua zerada', async () => {
      const { body } = await request(server)
        .post(ADMIN_COUPONS)
        .set(as())
        .send({
          code: 'blackfriday',
          title: 'Black Friday',
          tagline: 'só neste fim de semana',
          percentOff: 20,
          maxUses: 50,
          showOnHome: true,
        })
        .expect(201);

      expect(body).toMatchObject({
        code: 'BLACKFRIDAY',
        slug: 'black-friday',
        discountLabel: '20% OFF',
        usedCount: 0,
        holdingCount: 0,
        remainingUses: 50,
        wholeStore: true,
        status: 'live',
      });
    });

    /** Dois descontos no mesmo cupom seria o código escolhendo em silêncio. */
    it('recusa cupom com os dois tipos de desconto', async () => {
      await request(server)
        .post(ADMIN_COUPONS)
        .set(as())
        .send({ code: 'DOIS', title: 'Dois', percentOff: 20, amountOffCents: 3_000 })
        .expect(422);
    });

    it('recusa cupom sem desconto nenhum', async () => {
      await request(server)
        .post(ADMIN_COUPONS)
        .set(as())
        .send({ code: 'VAZIO', title: 'Vazio' })
        .expect(422);
    });

    it('recusa campanha que termina antes de começar', async () => {
      await request(server)
        .post(ADMIN_COUPONS)
        .set(as())
        .send({
          code: 'INVERTIDA',
          title: 'Invertida',
          percentOff: 20,
          startsAt: '2026-12-01T00:00:00.000Z',
          endsAt: '2026-11-01T00:00:00.000Z',
        })
        .expect(422);
    });

    it('recusa código repetido', async () => {
      await createCoupon({ code: 'BLACKFRIDAY', percentOff: 20 });

      await request(server)
        .post(ADMIN_COUPONS)
        .set(as())
        .send({ code: 'BLACKFRIDAY', title: 'Outra', percentOff: 10 })
        .expect(409);
    });

    /** O endereço não muda com o nome: o link da campanha já circulou. */
    it('mantem o endereço quando a campanha e renomeada', async () => {
      const id = await createCoupon({ code: 'BLACKFRIDAY', title: 'Black Friday', percentOff: 20 });

      const { body } = await request(server)
        .patch(`${ADMIN_COUPONS}/${id}`)
        .set(as())
        .send({ title: 'Black Friday 2026' })
        .expect(200);

      expect(body.title).toBe('Black Friday 2026');
      expect(body.slug).toBe('black-friday');
    });

    it('não oferece a área para quem não administra a loja', async () => {
      await request(server).get(ADMIN_COUPONS).expect(401);
    });
  });

  /* ---- Bancada ---------------------------------------------------------- */

  async function signIn(): Promise<string> {
    const email = 'dona@maisonessence.com';

    await users.create({
      name: 'Dona',
      email,
      passwordHash: await app.get(PasswordService).hash(PASSWORD),
      role: USER_ROLES.OWNER,
      isActive: true,
      mustChangePassword: false,
    });

    const response = await request(server)
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);

    return response.body.accessToken as string;
  }

  function as(): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  /** Um perfume, uma vela e uma cidade atendida. */
  async function seedStore(): Promise<Seeded> {
    const perfume = await products.create({
      name: 'Asad',
      slug: 'asad',
      brand: 'Lattafa',
      images: ['asad-capa'],
      variants: [{ sku: 'ASAD-100', label: '100 ml', priceCents: PRICE_PERFUME, stock: 10 }],
      isActive: true,
    });
    const candle = await products.create({
      name: 'Vela Perfumada',
      slug: 'vela-perfumada',
      brand: 'Maison',
      images: ['vela-capa'],
      variants: [{ sku: 'VELA-1', label: 'única', priceCents: PRICE_CANDLE, stock: 10 }],
      isActive: true,
    });
    const city = await cities.create({
      name: 'Sobral',
      state: 'CE',
      feeCents: CITY_FEE,
      estimatedDays: 2,
    });

    await payments.create({
      acceptsPix: true,
      pixDiscountPercent: PIX_PERCENT,
      acceptsCard: true,
      maxInstallments: 12,
      interestFreeUpTo: 3,
      // Tabela zerada: aqui o parcelamento não pode mexer no total, senão o
      // teste passa a falar de taxa em vez de falar de cupom.
      cardRates: Array.from({ length: 12 }, (_, index) => ({
        installments: index + 1,
        linkPercent: 0,
        tapPercent: 0,
      })),
      minInstallmentCents: 2_000,
    });
    await store.create({
      whatsappNumber: '5588999999999',
      pickupEnabled: true,
      freeShippingMinCents: null,
    });

    return {
      perfumeId: perfume._id.toHexString(),
      perfumeVariantId: perfume.variants[0]!.id as string,
      candleId: candle._id.toHexString(),
      candleVariantId: candle.variants[0]!.id as string,
      cityId: city._id.toHexString(),
    };
  }

  /** Um cupom de 20% no ar, sem teto, para a loja inteira. */
  async function createCoupon(overrides: Record<string, unknown> = {}): Promise<string> {
    const created = await coupons.create({
      code: 'TESTE',
      title: 'Campanha de teste',
      percentOff: 20,
      amountOffCents: null,
      maxUses: null,
      productIds: [],
      showOnHome: false,
      isActive: true,
      ...overrides,
    });

    return created._id.toHexString();
  }

  function perfumeLine(): Record<string, unknown> {
    return { productId: seeded.perfumeId, variantId: seeded.perfumeVariantId, quantity: 1 };
  }

  function candleLine(): Record<string, unknown> {
    return { productId: seeded.candleId, variantId: seeded.candleVariantId, quantity: 1 };
  }

  /** Um perfume, entrega em Sobral, cartão a vista. */
  function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      items: [perfumeLine()],
      fulfillment: { mode: FULFILLMENT_MODES.DELIVERY, cityId: seeded.cityId },
      payment: { method: PAYMENT_METHODS.CARD, cardMode: 'link', installments: 1 },
      customer: { name: 'Maria Silva', phone: '(88) 99999-9999' },
      address: {
        street: 'Rua das Flores',
        number: '123',
        district: 'Centro',
        zipCode: '62000-000',
        reference: 'perto da praca',
      },
      ...overrides,
    };
  }

  function quoteCart(overrides: Record<string, unknown> = {}): request.Test {
    return request(server).post(QUOTE).send(body(overrides));
  }

  /**
   * Cota e fecha, como o checkout faz: o total conferido e o que a cliente viu.
   *
   * A cotação acontece aqui dentro, e não no caso de teste, porque e assim que
   * o pedido nasce de verdade — e porque `expectedTotalCents` escrito a mão
   * transformaria qualquer erro de conta numa recusa 409 em vez de uma
   * asserção que falha dizendo o número errado.
   */
  async function place(
    overrides: Record<string, unknown> = {},
    expected = 201,
  ): Promise<request.Response> {
    const payload = body(overrides);
    const { body: quote } = await request(server).post(QUOTE).send(payload).expect(200);

    return request(server)
      .post(ORDERS)
      .set('x-forwarded-for', IP)
      .send({ ...payload, expectedTotalCents: quote.totalCents })
      .expect(expected);
  }

  function setStatus(orderId: string, status: string): request.Test {
    return request(server)
      .patch(`${ADMIN_ORDERS}/${orderId}/status`)
      .set(as())
      .send({ status });
  }

  async function usedCountOf(code: string): Promise<number> {
    const coupon = await coupons.findOne({ code }).exec();

    return coupon?.usedCount ?? -1;
  }
});
