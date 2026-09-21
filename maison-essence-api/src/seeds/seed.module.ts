import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../modules/auth/auth.module.js';
import {
  Category,
  CategorySchema,
  Customer,
  CustomerSchema,
  DeliveryCity,
  DeliveryCitySchema,
  Order,
  OrderSchema,
  PaymentSettings,
  PaymentSettingsSchema,
  Product,
  ProductSchema,
  QuantityDiscount,
  QuantityDiscountSchema,
  RateLimitHit,
  RateLimitHitSchema,
  StoreSettings,
  StoreSettingsSchema,
} from '../schemas.js';
import { DemoSeedService } from './demo-seed.service.js';

/**
 * Contexto dos comandos de seed.
 *
 * Nao e o `AppModule`: um seed nao precisa de HTTP, de guard nem de pipe de
 * validacao. Precisa da mesma validacao de ambiente, da mesma conexao e dos
 * mesmos servicos — e por isso o `AuthModule` entra inteiro, para que o
 * primeiro SUPER_ADMIN nasca pelo mesmo `BootstrapService` que a rota usa,
 * com o mesmo argon2id. Seed com caminho proprio de criacao e onde aparece o
 * usuario que o login nao reconhece.
 *
 * A lista de schemas vai alem do que os seeds gravam de proposito: o runner
 * cria os indices de tudo que estiver registrado aqui, e um banco novo no
 * Atlas sobe sem indice nenhum (`autoIndex` so vale em desenvolvimento). Como
 * o seed e a primeira coisa que roda contra esse banco, e o momento certo de
 * criar todos — inclusive os de colecoes que ainda nao tem modulo.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
      { name: QuantityDiscount.name, schema: QuantityDiscountSchema },
      { name: DeliveryCity.name, schema: DeliveryCitySchema },
      { name: StoreSettings.name, schema: StoreSettingsSchema },
      { name: PaymentSettings.name, schema: PaymentSettingsSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: RateLimitHit.name, schema: RateLimitHitSchema },
    ]),
  ],
  providers: [DemoSeedService],
})
export class SeedModule {}
