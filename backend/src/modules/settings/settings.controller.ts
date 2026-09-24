import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';
import type { SettingsView } from './settings.view.js';

/**
 * Configurações da loja pelo painel.
 *
 * Documento único: não há `POST` nem `:id`, só ler e alterar.
 *
 * ## Por que só o SUPER_ADMIN
 *
 * Um degrau acima de `MANAGES_STORE`, como a importação de catálogo, e pela
 * mesma natureza de risco: o que se muda aqui não e um produto, e a moldura
 * da loja inteira. O número do WhatsApp errado manda todo pedido para o
 * vazio, a chave da barra de avisos aparece em toda página, e uma página
 * institucional despublicada tira do ar um link que já circula no WhatsApp de
 * quem comprou.
 *
 * Nada disso muda no dia a dia, e nenhuma dessas decisões e tomada sozinha —
 * são configurações de implantação, feitas com quem mantem o sistema. Quem
 * opera a loja cuida de catálogo, pedido, entrega e pagamento.
 *
 * O `@CurrentUser()` no PATCH não e enfeite: e ele que a trilha de auditoria
 * registra junto do diff.
 */
@Roles(USER_ROLES.SUPER_ADMIN)
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
