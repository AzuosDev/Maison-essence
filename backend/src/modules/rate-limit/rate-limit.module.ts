import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RateLimitHit, RateLimitHitSchema } from '../../schemas.js';
import { MongoRateLimitStorage } from './mongo-rate-limit.storage.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitService } from './rate-limit.service.js';
import { RateLimitStorage } from './rate-limit.storage.js';

const rateLimitHit = { name: RateLimitHit.name, schema: RateLimitHitSchema };

/**
 * O limite de chamadas da API inteira.
 *
 * O guard entra como `APP_GUARD` e este módulo e o primeiro da lista do
 * `AppModule`: guards globais rodam na ordem em que os módulos são
 * registrados, e o limite precisa vir antes da autenticação — a tentativa de
 * login errada tem que ser contada, e ela nunca passa do primeiro guard.
 *
 * O armazenamento e um provider só, pedido pelo token `RateLimitStorage`: o
 * guard e o `RateLimitService` recebem a mesma instância, e não há como as
 * duas contagens divergirem um dia.
 */
@Module({
  imports: [MongooseModule.forFeature([rateLimitHit])],
  providers: [
    {
      provide: RateLimitStorage,
      inject: [getModelToken(RateLimitHit.name)],
      useFactory: (hits: Model<RateLimitHit>): RateLimitStorage =>
        new MongoRateLimitStorage(hits),
    },
    RateLimitService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [RateLimitService],
})
export class RateLimitModule {}
