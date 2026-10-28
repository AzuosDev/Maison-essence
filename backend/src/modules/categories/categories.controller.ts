import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
import { MANAGES_STORE, READS_CATALOG } from '../../common/roles.js';
import { CategoriesService } from './categories.service.js';
import type { CategoryView, WithChildren } from './category.view.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

/**
 * Categorias pelo painel.
 *
 * Mexer no catálogo e do gerente (`MANAGES_STORE`); ler e do STAFF também,
 * que precisa da árvore para achar produto e conferir pedido — dai o `@Roles`
 * próprio no GET, que sobrepoe o do controller.
 *
 * Criar, renomear, reordenar e ativar/desativar ficam com quem opera a loja.
 * Só o `DELETE` sobe para o `SUPER_ADMIN`, pelo que ele faz de diferente:
 * desativar tira a categoria do menu da vitrine e se desfaz num clique;
 * excluir apaga o registro e não tem volta. Quem opera tem o primeiro
 * caminho, que resolve o caso real — a categoria que saiu de linha.
 */
@Roles(...MANAGES_STORE)
@Controller('admin/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Roles(...READS_CATALOG)
  @Get()
  list(): Promise<WithChildren<CategoryView>[]> {
    return this.categories.list();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryView> {
    return this.categories.create(dto);
  }

  /**
   * Antes do `PATCH :id` de propósito: o Nest casa as rotas na ordem em que
   * são declaradas, e `reorder` cairia em `:id` como se fosse um id.
   */
  @Patch('reorder')
  reorder(@Body() dto: ReorderCategoriesDto): Promise<WithChildren<CategoryView>[]> {
    return this.categories.reorder(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryView> {
    return this.categories.update(id, dto);
  }

  @Roles(USER_ROLES.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
