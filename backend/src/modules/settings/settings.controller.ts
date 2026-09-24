import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';
import type { SettingsView } from './settings.view.js';

/**
 * Configuracoes da loja pelo painel.
 *
 * Documento unico: nao ha `POST` nem `:id`, so ler e alterar.
 *
 * ## Por que so o SUPER_ADMIN
 *
 * Um degrau acima de `MANAGES_STORE`, como a importacao de catalogo, e pela
 * mesma natureza de risco: o que se muda aqui nao e um produto, e a moldura
 * da loja inteira. O numero do WhatsApp errado manda todo pedido para o
 * vazio, a chave da barra de avisos aparece em toda pagina, e uma pagina
 * institucional despublicada tira do ar um link que ja circula no WhatsApp de
 * quem comprou.
 *
 * Nada disso muda no dia a dia, e nenhuma dessas decisoes e tomada sozinha —
 * sao configuracoes de implantacao, feitas com quem mantem o sistema. Quem
 * opera a loja cuida de catalogo, pedido, entrega e pagamento.
 *
 * O `@CurrentUser()` no PATCH nao e enfeite: e ele que a trilha de auditoria
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
