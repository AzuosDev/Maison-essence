import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentSettings, PaymentSettingsSchema } from '../../schemas.js';
import { InstallmentService } from './installment.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PublicPaymentsController } from './public-payments.controller.js';

/**
 * Regras de pagamento: o que a loja aceita e como o total se divide.
 *
 * Exporta os dois serviços porque o módulo de pedidos vai precisar dos dois —
 * `InstallmentService` para as parcelas e `PaymentsService.pixQuote` para o
 * desconto do PIX. São, junto do `DeliveryService`, as únicas fontes de
 * número no fechamento de um pedido.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: PaymentSettings.name, schema: PaymentSettingsSchema }]),
  ],
  controllers: [PaymentsController, PublicPaymentsController],
  providers: [PaymentsService, InstallmentService],
  exports: [PaymentsService, InstallmentService, MongooseModule],
})
export class PaymentsModule {}
