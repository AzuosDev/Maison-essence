import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { CdnCacheInterceptor } from './common/interceptors/cdn-cache.interceptor.js';
import { SanitizeResponseInterceptor } from './common/interceptors/sanitize-response.interceptor.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { DeliveryModule } from './modules/delivery/delivery.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    // Antes de tudo o que responde: guards globais rodam na ordem em que os
    // modulos sao registrados, e o limite de chamadas precisa contar a
    // tentativa de login antes de o guard de autenticacao recusa-la.
    RateLimitModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    UploadsModule,
    SettingsModule,
    DeliveryModule,
    PaymentsModule,
    CartModule,
    OrdersModule,
    CustomersModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CdnCacheInterceptor,
    },
  ],
})
export class AppModule {}
