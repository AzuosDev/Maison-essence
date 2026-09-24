import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
import type { CollectionCount } from './system.service.js';
import { SystemService } from './system.service.js';

/**
 * A área de sistema do painel.
 *
 * ## Por que só o SUPER_ADMIN
 *
 * Pelo mesmo motivo de `/admin/settings`: o que se lê aqui não e da loja, e
 * da instalação. Quantos documentos há em `refresh_tokens` ou em
 * `login_attempts` não ajuda quem vende, e desenha para quem olha o formato
 * interno do sistema — nomes de coleção, o que existe, o que cresce. Quem
 * mantem o sistema já conhece esse mapa; quem opera a loja não precisa dele.
 *
 * A saúde do processo fica fora daqui, em `/health`, e de propósito: aquela e
 * publica porque um monitor externo precisa alcança-lá sem credencial.
 */
@Roles(USER_ROLES.SUPER_ADMIN)
@Controller('admin/system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('collections')
  collections(): Promise<CollectionCount[]> {
    return this.system.collectionCounts();
  }
}
