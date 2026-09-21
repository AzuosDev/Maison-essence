import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MANAGES_STORE } from '../../common/roles.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto.js';
import type { PaymentSettingsView } from './payment-settings.view.js';
import { PaymentsService } from './payments.service.js';

/**
 * Regras de pagamento pelo painel.
 *
 * Documento unico: nao ha `POST` nem `:id`, so ler e alterar. `MANAGES_STORE`
 * sem excecao, inclusive na leitura — aqui esta a chave PIX para onde o
 * dinheiro da loja vai, e o STAFF nao tem o que fazer com ela.
 */
@Roles(...MANAGES_STORE)
@Controller('admin/payment-settings')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  get(): Promise<PaymentSettingsView> {
    return this.payments.adminView();
  }

  @Patch()
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsView> {
    return this.payments.update(actor, dto);
  }
}
