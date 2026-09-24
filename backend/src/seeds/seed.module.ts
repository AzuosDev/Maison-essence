import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuditModule } from '../modules/audit/audit.module.js';
import { AuthModule } from '../modules/auth/auth.module.js';
import { CatalogImportModule } from '../modules/catalog-import/catalog-import.module.js';
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
 * Não e o `AppModule`: um seed não precisa de HTTP, de guard nem de pipe de
 * validação. Precisa da mesma validação de ambiente, da mesma conexão e dos
 * mesmos serviços — e por isso o `AuthModule` entra inteiro, para que o
 * primeiro SUPER_ADMIN nasca pelo mesmo `BootstrapService` que a rota usa,
 * com o mesmo argon2id. Seed com caminho próprio de criação e onde aparece o
 * usuário que o login não reconhece.
 *
 * A lista de schemas vai além do que os seeds gravam de propósito: o runner
 * cria os índices de tudo que estiver registrado aqui, e um banco novo no
 * Atlas sobe sem índice nenhum (`autoIndex` só vale em desenvolvimento). Como
 * o seed e a primeira coisa que roda contra esse banco, e o momento certo de
 * criar todos — inclusive os de coleções que ainda não tem módulo.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    // O @Global() do módulo de auditoria só vale dentro do contexto que o
    // importa, e este contexto não e o AppModule: sem esta linha o
    // BootstrapService não resolve o AuditService e o seed morre no boot.
    AuditModule,
    AuthModule,
    // Traz o CatalogImportService para o npm run seed:catalog.
    CatalogImportModule,
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
