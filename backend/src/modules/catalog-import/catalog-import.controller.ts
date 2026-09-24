import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import {
  CATALOG_IMPORT_RATE_LIMIT,
  IMPORT_TIME_BUDGET_MS,
} from './catalog-import.constants.js';
import { CatalogImportService } from './catalog-import.service.js';
import { CatalogFormatError } from './catalog-file.js';
import type { CatalogImportReport } from './catalog-report.js';
import { ImportCatalogDto, ImportCatalogQueryDto } from './dto/import-catalog.dto.js';

/**
 * `POST /admin/catalog/import`.
 *
 * ## Por que a rota existe
 *
 * A Vercel não da shell. Sem esta rota, atualizar preço em massa exigiria um
 * desenvolvedor com o banco na mão toda vez que o fornecedor mandasse lista
 * nova — e a dona ficaria esperando por alguém para mudar o preço da própria
 * loja.
 *
 * ## Por que só o SUPER_ADMIN
 *
 * Uma importação reescreve o preço do catálogo inteiro em uma chamada. E a
 * operação mais destrutiva da API, mesmo fazendo tudo certo — e por isso ela
 * fica um degrau acima de `MANAGES_STORE`, que e quem edita produto a
 * produto. O `--dry-run` existe para que o degrau não vire um salto no escuro:
 * `?dryRun=true` devolve o relatório inteiro sem gravar nada.
 *
 * ## O relógio
 *
 * A função serverless morre no tempo dela, sem responder. Então a importação
 * roda com orçamento: chegando no teto, ela para entre dois lotes e devolve
 * `remaining`. Como tudo aqui e idempotente pelo slug, mandar o mesmo arquivo
 * de novo termina o serviço sem duplicar nada.
 */
@Roles(USER_ROLES.SUPER_ADMIN)
@RateLimit(CATALOG_IMPORT_RATE_LIMIT)
@Controller('admin/catalog')
export class CatalogImportController {
  constructor(private readonly imports: CatalogImportService) {}

  /**
   * `200`, e não `201`: nada foi criado no sentido da rota — o que ela devolve
   * e um relatório, não um recurso com endereço próprio.
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async import(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ImportCatalogQueryDto,
    @Body() body: ImportCatalogDto,
  ): Promise<CatalogImportReport> {
    try {
      return await this.imports.import(body, {
        dryRun: query.dryRun ?? false,
        only: query.only,
        deadlineMs: IMPORT_TIME_BUDGET_MS,
        actor: { id: actor.id, email: actor.email, role: actor.role },
      });
    } catch (error: unknown) {
      // O DTO já garante as duas listas, então só sobra o arquivo que nem
      // objeto e. 422 e não 500: o corpo chegou inteiro, ele e que esta errado.
      if (error instanceof CatalogFormatError) {
        throw new UnprocessableEntityException(error.message);
      }

      throw error;
    }
  }
}
