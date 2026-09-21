import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ProductsModule } from '../products/products.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { CartQuoteService } from './cart-quote.service.js';
import { CartController } from './cart.controller.js';

/**
 * A cotacao do carrinho.
 *
 * Nao registra model proprio: o carrinho nao e documento nenhum. Ele importa
 * os modulos que ja sao donos de cada numero — `ProductsModule` pelos precos
 * e pelas regras de desconto, `DeliveryModule` pela taxa, `PaymentsModule`
 * pelo desconto do PIX e pelas parcelas — e se limita a juntar as respostas.
 *
 * Modulo proprio, separado dos pedidos, porque a mesma conta serve a duas
 * rotas com contratos diferentes: aqui ela responde uma simulacao publica,
 * na criacao do pedido ela e refeita antes de gravar. Uma so implementacao
 * garante que a segunda nunca discorde da primeira sem motivo.
 */
@Module({
  imports: [ProductsModule, DeliveryModule, PaymentsModule, RateLimitModule],
  controllers: [CartController],
  providers: [CartQuoteService],
  exports: [CartQuoteService],
})
export class CartModule {}
