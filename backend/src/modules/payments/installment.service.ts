import { Injectable } from '@nestjs/common';
import { buildInstallmentOptions } from './installments.js';
import type { InstallmentOption } from './installments.js';
import { toInstallmentRules } from './payment-settings.view.js';
import { PaymentsService } from './payments.service.js';

/**
 * As opcoes de parcelamento de um total.
 *
 * Fonte unica, como o `DeliveryService` e para a taxa de entrega: o card do
 * produto, o checkout e a mensagem do WhatsApp perguntam aqui em vez de cada
 * um dividir o total pelo numero de parcelas. Divisao inteira com juros e
 * arredondamento reescrita em tres lugares diverge em um deles, e a
 * divergencia aparece no centavo que o cliente confere.
 */
@Injectable()
export class InstallmentService {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * As parcelas possiveis para este total, da a vista ate o maximo permitido.
   *
   * Lista vazia quando a loja nao aceita cartao: nao ha opcao a oferecer, e
   * quem chama nao precisa perguntar antes se pode perguntar.
   */
  async buildOptions(totalCents: number): Promise<InstallmentOption[]> {
    const settings = await this.payments.current();

    if (!settings.acceptsCard) {
      return [];
    }

    return buildInstallmentOptions(totalCents, toInstallmentRules(settings));
  }
}
