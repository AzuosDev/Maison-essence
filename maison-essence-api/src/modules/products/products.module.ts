import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema, Product, ProductSchema } from '../../schemas.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

/**
 * Produtos e variantes.
 *
 * Registra o model `Order` para uma pergunta so: esta variante ja foi
 * vendida? E ela que decide entre apagar a variante que saiu da lista e
 * apenas aposenta-la, porque o cancelamento de um pedido devolve o estoque
 * procurando a variante pelo id guardado no item.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, MongooseModule],
})
export class ProductsModule {}
