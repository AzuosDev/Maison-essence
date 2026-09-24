import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema, Product, ProductSchema } from '../../schemas.js';
import { CatalogImportController } from './catalog-import.controller.js';
import { CatalogImportService } from './catalog-import.service.js';

/**
 * A importação de catálogo, pelo comando e pela rota.
 *
 * O módulo não depende de `ProductsModule` nem de `CategoriesModule` de
 * propósito: aqueles serviços existem para editar **um** produto pelo painel,
 * com auditoria de preço por chamada e 409 no slug ocupado. A importação faz
 * outra coisa — funde uma lista inteira preservando o que já esta gravado — e
 * chamar `ProductsService.create` em laço daria 269 entradas de trilha e
 * nenhuma das regras de preservação.
 *
 * O que ele compartilha com eles são os **schemas** e os **DTOs**, que e onde
 * a divergência doeria: um campo novo no produto passa a valer aqui no mesmo
 * dia.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [CatalogImportController],
  providers: [CatalogImportService],
  exports: [CatalogImportService],
})
export class CatalogImportModule {}
