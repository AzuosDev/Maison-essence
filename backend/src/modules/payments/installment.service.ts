import { Injectable } from '@nestjs/common';
import { buildInstallmentOptions } from './installments.js';
import type { InstallmentOption } from './installments.js';
import { toInstallmentRules } from './payment-settings.view.js';
import { PaymentsService } from './payments.service.js';

/**
 * As opções de parcelamento de um total.
 *
 * Fonte única, como o `DeliveryService` e para a taxa de entrega: o card do
 * produto, o checkout e a mensagem do WhatsApp perguntam aqui em vez de cada
 * um dividir o total pelo número de parcelas. Divisão inteira com juros e
 * arredondamento reescrita em três lugares diverge em um deles, e a
 * divergência aparece no centavo que o cliente confere.
 */
@Injectable()
export class InstallmentService {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * As parcelas possíveis para este total, da a vista até o máximo permitido.
   *
   * Lista vazia quando a loja não aceita cartão: não há opção a oferecer, e
   * quem chama não precisa perguntar antes se pode perguntar.
   */
  async buildOptions(totalCents: number): Promise<InstallmentOption[]> {
    const settings = await this.payments.current();

    if (!settings.acceptsCard) {
      return [];
    }

    return buildInstallmentOptions(totalCents, toInstallmentRules(settings));
  }
}
