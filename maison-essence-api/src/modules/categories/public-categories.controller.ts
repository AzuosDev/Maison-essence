import { Controller, Get, HttpStatus, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { CategoriesService } from './categories.service.js';
import type { PublicCategoryView, WithChildren } from './category.view.js';

/** O que o cliente recebe quando pede um endereco que mudou de nome. */
export interface MovedCategory {
  /** O endereco atual, para o cliente que trata o 301 na mao. */
  slug: string;
  location: string;
}

/**
 * Categorias para a vitrine. Sem autenticacao: e o menu da loja aberta.
 */
@Public()
@Controller('categories')
export class PublicCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** A arvore inteira do menu, so com o que esta ativo. */
  @Get()
  tree(): Promise<WithChildren<PublicCategoryView>[]> {
    return this.categories.publicTree();
  }

  /**
   * Uma categoria pelo endereco, com as subcategorias dela.
   *
   * Endereco antigo responde 301 com `Location` para o atual, em vez de 404:
   * o link da categoria ja circulou no WhatsApp antes da dona renomea-la, e
   * quem clicar semanas depois precisa cair na categoria certa. Quem segue
   * redirecionamento — navegador, WhatsApp, buscador — chega sozinho; quem
   * nao segue acha o endereco novo no corpo da resposta.
   */
  @Get(':slug')
  async bySlug(
    @Param('slug') slug: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WithChildren<PublicCategoryView> | MovedCategory> {
    const found = await this.categories.findPublicBySlug(slug);

    if (found.outcome === 'moved') {
      const location = siblingPath(request, found.slug);

      response.status(HttpStatus.MOVED_PERMANENTLY);
      response.setHeader('Location', location);

      return { slug: found.slug, location };
    }

    return found.category;
  }
}

/**
 * Troca o ultimo trecho do caminho pelo slug novo.
 *
 * Montar a partir da URL recebida, e nao de uma constante, e o que mantem o
 * `Location` correto se o prefixo global mudar ou a API for servida sob outro
 * caminho. `originalUrl` preserva esse prefixo, que o Express tira de `url`.
 */
function siblingPath(request: Request, slug: string): string {
  const [path] = (request.originalUrl || request.url).split('?');

  return `${path.slice(0, path.lastIndexOf('/'))}/${encodeURIComponent(slug)}`;
}
