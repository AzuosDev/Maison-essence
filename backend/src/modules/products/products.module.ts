import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Category,
  CategorySchema,
  Order,
  OrderSchema,
  Product,
  ProductSchema,
  QuantityDiscount,
  QuantityDiscountSchema,
  StoreSettings,
  StoreSettingsSchema,
} from '../../schemas.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { PublicCatalogService } from './public-catalog.service.js';
import { PublicProductsController } from './public-products.controller.js';

/**
 * Produtos e variantes, no painel e na vitrine.
 *
 * Registra `Order` para duas perguntas: esta variante já foi vendida? — a que
 * decide entre apagar a variante que saiu da lista e apenas aposenta-lá, por
 * causa do estoque devolvido no cancelamento — e quanto cada produto vendeu,
 * que e a prateleira de mais vendidos.
 *
 * `Category` entra para resolver o filtro por slug da vitrine, e
 * `QuantityDiscount` para o card anunciar o desconto progressivo.
 *
 * `StoreSettings` entra por uma pergunta só: qual produto a dona escolheu
 * para "O perfume da vez". E o model, e não o `SettingsService`, porque o que
 * se lê e um id — montar o produto a partir dele e trabalho da vitrine, e
 * importar o módulo de configurações inteiro para ler um campo acopla os dois
 * domínios sem precisar. O módulo de categorias registra `Product` pelo mesmo
 * tipo de motivo; `forFeature` repetido e idempotente.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Category.name, schema: CategorySchema },
      { name: QuantityDiscount.name, schema: QuantityDiscountSchema },
      { name: StoreSettings.name, schema: StoreSettingsSchema },
    ]),
  ],
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService, PublicCatalogService],
  exports: [ProductsService, PublicCatalogService, MongooseModule],
})
export class ProductsModule {}
