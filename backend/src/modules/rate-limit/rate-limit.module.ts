import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RateLimitHit, RateLimitHitSchema } from '../../schemas.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitService } from './rate-limit.service.js';

/**
 * Limite de chamadas das rotas publicas.
 *
 * Modulo proprio, e nao um servico dentro do carrinho, porque a mesma regra
 * vale para mais de uma rota aberta — a cotacao agora, a criacao de pedido
 * depois — e duas implementacoes do mesmo contador divergiriam na primeira
 * correcao.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: RateLimitHit.name, schema: RateLimitHitSchema }]),
  ],
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard, MongooseModule],
})
export class RateLimitModule {}
