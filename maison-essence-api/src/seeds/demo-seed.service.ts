import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { HydratedDocument, Model, Types } from 'mongoose';
import type { Env } from '../config/env.schema.js';
import { Category } from '../modules/categories/schemas/category.schema.js';
import { DeliveryCity } from '../modules/delivery/schemas/delivery-city.schema.js';
import { PaymentSettings } from '../modules/payments/schemas/payment-settings.schema.js';
import type { PaymentSettingsModel } from '../modules/payments/schemas/payment-settings.schema.js';
import { Product } from '../modules/products/schemas/product.schema.js';
import { StoreSettings } from '../modules/settings/schemas/store-settings.schema.js';
import type { StoreSettingsModel } from '../modules/settings/schemas/store-settings.schema.js';
import {
  DEMO_CATEGORIES,
  DEMO_CITIES,
  DEMO_INSTITUTIONAL_PAGES,
  DEMO_PAYMENT_SETTINGS,
  DEMO_PRODUCTS,
  DEMO_STORE_SETTINGS,
} from './demo-data.js';
import type { DemoProduct } from './demo-data.js';

/** Quantos registros de cada colecao nasceram e quantos foram reescritos. */
export interface SeedCount {
  created: number;
  updated: number;
}

export interface DemoSeedSummary {
  categories: SeedCount;
  products: SeedCount;
  cities: SeedCount;
}

export const DEMO_SEED_REFUSED_MESSAGE =
  'O seed de demonstracao sobrescreve as configuracoes da loja e nao roda com NODE_ENV=production. Use --force se e isso mesmo que voce quer.';

export class DemoSeedRefusedError extends Error {
  constructor() {
    super(DEMO_SEED_REFUSED_MESSAGE);
    this.name = 'DemoSeedRefusedError';
  }
}

/**
 * Popula a loja com um catalogo de exemplo.
 *
 * Idempotente por chave natural: categoria e produto pelo `slug`, cidade pelo
 * par nome+estado, configuracoes pelo documento unico. Rodar de novo reescreve
 * os mesmos registros em vez de criar copias, e nao toca no que foi cadastrado
 * a mao fora desta lista.
 *
 * Reescrever, porem, e destrutivo para quem ja mexeu no painel: as
 * configuracoes da loja voltam para os valores de demonstracao. Por isso o
 * seed se recusa a rodar em producao sem `--force` — o unico caso em que ele
 * apaga trabalho de alguem e exatamente esse.
 */
@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger('DemoSeed');

  constructor(
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(DeliveryCity.name) private readonly cities: Model<DeliveryCity>,
    @InjectModel(StoreSettings.name) private readonly storeSettings: StoreSettingsModel,
    @InjectModel(PaymentSettings.name) private readonly paymentSettings: PaymentSettingsModel,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async run(options: { force: boolean }): Promise<DemoSeedSummary> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production' && !options.force) {
      throw new DemoSeedRefusedError();
    }

    const categories = await this.seedCategories();
    const products = await this.seedProducts();
    const cities = await this.seedCities();

    await this.seedStoreSettings();
    await this.seedPaymentSettings();

    return { categories, products, cities };
  }

  private async seedCategories(): Promise<SeedCount> {
    const count: SeedCount = { created: 0, updated: 0 };

    for (const data of DEMO_CATEGORIES) {
      const existing = await this.categories.findOne({ slug: data.slug }).exec();
      const document = existing ?? new this.categories();

      // O slug vai explicito: sem ele o hook do schema geraria um a partir do
      // nome, e a chave que o proximo seed procura deixaria de ser previsivel.
      document.set({
        name: data.name,
        slug: data.slug,
        parentId: null,
        order: data.order,
        isActive: true,
      });

      await document.save();
      tally(count, existing);
    }

    return count;
  }

  private async seedProducts(): Promise<SeedCount> {
    const count: SeedCount = { created: 0, updated: 0 };
    const categoryIds = await this.categoryIdsBySlug();

    for (const data of DEMO_PRODUCTS) {
      const existing = await this.products.findOne({ slug: data.slug }).exec();
      const document = existing ?? new this.products();

      document.set({
        name: data.name,
        slug: data.slug,
        description: data.description,
        brand: data.brand,
        categoryIds: resolveCategories(data, categoryIds),
        variants: data.variants.map((variant) => ({ ...variant, isActive: true })),
        tags: [...data.tags],
        isActive: true,
        isFeatured: data.isFeatured,
        isReadyToShip: data.isReadyToShip,
      });

      await document.save();
      tally(count, existing);
    }

    return count;
  }

  private async seedCities(): Promise<SeedCount> {
    const count: SeedCount = { created: 0, updated: 0 };

    for (const data of DEMO_CITIES) {
      const existing = await this.cities
        .findOne({ name: data.name, state: data.state })
        .exec();
      const document = existing ?? new this.cities();

      document.set({
        name: data.name,
        state: data.state,
        feeCents: data.feeCents,
        estimatedDays: data.estimatedDays,
        minOrderForFreeCents: data.minOrderForFreeCents,
        order: data.order,
        isActive: true,
      });

      await document.save();
      tally(count, existing);
    }

    return count;
  }

  private async seedStoreSettings(): Promise<void> {
    const settings = await this.storeSettings.getOrCreate();

    settings.set({
      ...DEMO_STORE_SETTINGS,
      pickupAddress: { ...DEMO_STORE_SETTINGS.pickupAddress },
      socialLinks: { ...DEMO_STORE_SETTINGS.socialLinks },
      institutionalPages: DEMO_INSTITUTIONAL_PAGES.map((page) => ({ ...page, isActive: true })),
      // Banner exige `imageDesktop`, que so faz sentido com um publicId real
      // no Cloudinary. A home fica sem carrossel ate a dona subir a arte dela.
      banners: [],
    });

    await settings.save();
  }

  private async seedPaymentSettings(): Promise<void> {
    const settings = await this.paymentSettings.getOrCreate();

    settings.set({ ...DEMO_PAYMENT_SETTINGS });

    await settings.save();
  }

  /** Mapa slug -> _id, para os produtos apontarem para as categorias. */
  private async categoryIdsBySlug(): Promise<Map<string, Types.ObjectId>> {
    const found = await this.categories
      .find({ slug: { $in: DEMO_CATEGORIES.map((category) => category.slug) } })
      .select('_id slug')
      .exec();

    return new Map(found.map((category) => [category.slug, category._id]));
  }

  /** Uma linha por colecao, para quem esta olhando o terminal. */
  report(summary: DemoSeedSummary): void {
    for (const [label, count] of Object.entries(summary)) {
      this.logger.log(`${label}: ${count.created} criados, ${count.updated} atualizados`);
    }

    this.logger.log('Configuracoes da loja e de pagamento gravadas.');
  }
}

function tally(count: SeedCount, existing: HydratedDocument<unknown> | null): void {
  if (existing) {
    count.updated += 1;
  } else {
    count.created += 1;
  }
}

function resolveCategories(
  product: DemoProduct,
  categoryIds: Map<string, Types.ObjectId>,
): Types.ObjectId[] {
  return product.categorySlugs.map((slug) => {
    const id = categoryIds.get(slug);

    if (!id) {
      throw new Error(`Categoria ${slug} nao encontrada para o produto ${product.slug}.`);
    }

    return id;
  });
}
