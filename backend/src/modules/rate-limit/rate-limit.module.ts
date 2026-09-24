import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Model } from 'mongoose';
import { RateLimitHit, RateLimitHitSchema } from '../../schemas.js';
import { MongoThrottlerStorage } from './mongo-throttler.storage.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { resolveRateLimitRule } from './rate-limit.rule.js';
import { RateLimitService } from './rate-limit.service.js';

const rateLimitHit = { name: RateLimitHit.name, schema: RateLimitHitSchema };

/**
 * O limite de chamadas da API inteira.
 *
 * O guard entra como `APP_GUARD` e este módulo e o primeiro da lista do
 * `AppModule`: guards globais rodam na ordem em que os módulos são
 * registrados, e o limite precisa vir antes da autenticação — a tentativa de
 * login errada tem que ser contada, e ela nunca passa do primeiro guard.
 *
 * O `@nestjs/throttler` entra com o armazenamento trocado. O dele e um `Map`
 * de processo, que em serverless não limita nada (ver
 * `mongo-throttler.storage.ts`); o que sobra dele — a leitura dos metadados da
 * rota, os cabeçalhos `X-RateLimit-*`, o `Retry-After` — e justamente o que
 * não vale a pena reescrever.
 */
@Module({
  imports: [
    MongooseModule.forFeature([rateLimitHit]),
    ThrottlerModule.forRootAsync({
      // O `forRootAsync` só aceita `imports`, então o model e pedido de novo
      // aqui. São dois providers para o mesmo model compilado, não duas
      // conexões.
      imports: [MongooseModule.forFeature([rateLimitHit])],
      inject: [Reflector, getModelToken(RateLimitHit.name)],
      useFactory: (reflector: Reflector, hits: Model<RateLimitHit>): ThrottlerModuleOptions => ({
        storage: new MongoThrottlerStorage(hits),
        // Um throttler só. Vários throttlers nomeados valeriam todos ao mesmo
        // tempo em toda rota, e o que este projeto quer e o contrário: uma
        // regra por rota, escolhida por `resolveRateLimitRule`. As duas
        // funções abaixo são o que faz a regra da rota chegar até o guard.
        throttlers: [
          {
            name: 'default',
            limit: (context) => resolveRateLimitRule(reflector, context).limit,
            ttl: (context) => resolveRateLimitRule(reflector, context).windowSeconds * 1000,
          },
        ],
      }),
    }),
  ],
  providers: [RateLimitService, { provide: APP_GUARD, useClass: RateLimitGuard }],
  exports: [RateLimitService],
})
export class RateLimitModule {}
