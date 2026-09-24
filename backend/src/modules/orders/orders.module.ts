import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema, Product, ProductSchema } from '../../schemas.js';
import { CartModule } from '../cart/cart.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { OrderStockService } from './order-stock.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/**
 * Pedidos: o checkout público e a gestão pelo painel.
 *
 * Importa `CartModule` em vez de reimplementar a conta. E a regra que sustenta
 * a fase inteira: o pedido e gravado pelos mesmos números que a cotação
 * mostrou, calculados pelo mesmo código, e não por uma segunda versão da
 * mesma lógica que um dia divergiria da primeira.
 *
 * `Product` entra porque o estoque e baixado aqui — e o único lugar do sistema
 * que escreve em `variants.stock` sem passar pelo cadastro. `SettingsModule`
 * vem pelo número do WhatsApp e pelas instruções de retirada, que são o
 * destino e o rodapé da mensagem.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    CartModule,
    CustomersModule,
    SettingsModule,
    RateLimitModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderStockService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
