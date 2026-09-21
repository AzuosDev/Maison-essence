import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema, Product, ProductSchema } from '../../schemas.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { PublicCategoriesController } from './public-categories.controller.js';

/**
 * Categorias do catalogo, no painel e na vitrine.
 *
 * Registra tambem o model `Product` — nao para gerenciar produto, mas porque
 * duas regras daqui dependem dele: a contagem que o menu exibe e a recusa em
 * excluir categoria que ainda tem produto. O modulo de produtos registra o
 * mesmo model por conta propria; `forFeature` repetido e idempotente.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CategoriesController, PublicCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService, MongooseModule],
})
export class CategoriesModule {}
