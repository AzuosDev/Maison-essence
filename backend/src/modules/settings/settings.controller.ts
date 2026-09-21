import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MANAGES_STORE } from '../../common/roles.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';
import type { SettingsView } from './settings.view.js';

/**
 * Configuracoes da loja pelo painel.
 *
 * Documento unico: nao ha `POST` nem `:id`, so ler e alterar. `MANAGES_STORE`
 * sem excecao — o STAFF le pedido e catalogo, mas o numero do WhatsApp para
 * onde vai todo pedido da loja nao e coisa que se mude sem ser a dona.
 *
 * O `@CurrentUser()` no PATCH nao e enfeite: e ele que a trilha de auditoria
 * registra junto do diff.
 */
@Roles(...MANAGES_STORE)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<SettingsView> {
    return this.settings.adminView();
  }

  @Patch()
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsView> {
    return this.settings.update(actor, dto);
  }
}
