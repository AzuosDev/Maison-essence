import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Coupon, CouponSchema, Order, OrderSchema } from '../../schemas.js';
import { CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';
import { PublicCouponsController } from './public-coupons.controller.js';

/**
 * Cupons e campanhas promocionais.
 *
 * Registra `Order` para uma pergunta só, e ela e a que faz o teto de usos
 * valer: quantos pedidos estão segurando este cupom sem ter virado venda? E o
 * model, e não o `OrdersModule`, pelo mesmo motivo que `ProductsModule`
 * registra `Order` para saber se uma variante já foi vendida — importar o
 * módulo de pedidos inteiro para fazer uma contagem acoplaria os dois domínios
 * sem precisar, e nesta direção fecharia um ciclo: e `OrdersModule` que
 * importa este, para contar o uso quando a gerente marca "Vendido".
 *
 * Exporta `CouponsService` porque três módulos perguntam a ele: o carrinho
 * (quanto este código tira desta sacola), os pedidos (contar e devolver o uso)
 * e a vitrine (quais produtos estão na campanha deste endereço).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [CouponsController, PublicCouponsController],
  providers: [CouponsService],
  exports: [CouponsService, MongooseModule],
})
export class CouponsModule {}
