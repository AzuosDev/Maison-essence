import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MANAGES_STORE } from '../../common/roles.js';
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
 * ## A permissão aqui e por campo, não por rota
 *
 * `MANAGES_STORE` abre a tela para quem opera a loja, porque e aqui que mora
 * o que muda no expediente: o horário de atendimento, a barra de avisos, o
 * número do WhatsApp, a retirada na loja. Depender de quem mantem o sistema
 * para corrigir um horário e o tipo de dependência que faz a pessoa parar de
 * corrigir.
 *
 * Só que a mesma tela guarda a moldura da loja — o carrossel da home, o
 * perfume da vez, as páginas do rodapé, as redes sociais —, e essa parte
 * continua sendo do administrador. A divisão não cabe num decorator, que
 * decide por rota; ela mora em `settings-access.policy.ts` e e aplicada no
 * serviço, campo a campo, antes de qualquer gravação.
 *
 * O GET não divide nada: o gerente lê a tela inteira. Esconder o valor que
 * ele não pode editar só o faria perguntar o que mudou na home.
 *
 * O `@CurrentUser()` no PATCH não e enfeite: e ele que decide o que pode ser
 * gravado, e e ele que a trilha de auditoria registra junto do diff.
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
