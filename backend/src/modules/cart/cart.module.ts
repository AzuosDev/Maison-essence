import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ProductsModule } from '../products/products.module.js';
import { CartQuoteService } from './cart-quote.service.js';
import { CartController } from './cart.controller.js';

/**
 * A cotação do carrinho.
 *
 * Não registra model próprio: o carrinho não e documento nenhum. Ele importa
 * os módulos que já são donos de cada número — `ProductsModule` pelos preços
 * e pelas regras de desconto, `DeliveryModule` pela taxa, `PaymentsModule`
 * pelo desconto do PIX e pelas parcelas — e se limita a juntar as respostas.
 *
 * Módulo próprio, separado dos pedidos, porque a mesma conta serve a duas
 * rotas com contratos diferentes: aqui ela responde uma simulação publica,
 * na criação do pedido ela e refeita antes de gravar. Uma só implementação
 * garante que a segunda nunca discorde da primeira sem motivo.
 */
@Module({
  imports: [ProductsModule, DeliveryModule, PaymentsModule],
  controllers: [CartController],
  providers: [CartQuoteService],
  exports: [CartQuoteService],
})
export class CartModule {}
