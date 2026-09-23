import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema, Product, ProductSchema } from '../../schemas.js';
import { CatalogImportController } from './catalog-import.controller.js';
import { CatalogImportService } from './catalog-import.service.js';

/**
 * A importacao de catalogo, pelo comando e pela rota.
 *
 * O modulo nao depende de `ProductsModule` nem de `CategoriesModule` de
 * proposito: aqueles servicos existem para editar **um** produto pelo painel,
 * com auditoria de preco por chamada e 409 no slug ocupado. A importacao faz
 * outra coisa — funde uma lista inteira preservando o que ja esta gravado — e
 * chamar `ProductsService.create` em laco daria 269 entradas de trilha e
 * nenhuma das regras de preservacao.
 *
 * O que ele compartilha com eles sao os **schemas** e os **DTOs**, que e onde
 * a divergencia doeria: um campo novo no produto passa a valer aqui no mesmo
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
