import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema, Product, ProductSchema } from '../../schemas.js';
import { CartModule } from '../cart/cart.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { OrderStockService } from './order-stock.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Pedidos: o checkout publico e a gestao pelo painel.
 *
 * Importa `CartModule` em vez de reimplementar a conta. E a regra que sustenta
 * a fase inteira: o pedido e gravado pelos mesmos numeros que a cotacao
 * mostrou, calculados pelo mesmo codigo, e nao por uma segunda versao da
 * mesma logica que um dia divergiria da primeira.
 *
 * `Product` entra porque o estoque e baixado aqui — e o unico lugar do sistema
 * que escreve em `variants.stock` sem passar pelo cadastro. `SettingsModule`
 * vem pelo numero do WhatsApp e pelas instrucoes de retirada, que sao o
 * destino e o rodape da mensagem.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    CartModule,
    SettingsModule,
    RateLimitModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderStockService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
