import { Injectable } from '@nestjs/common';
import type { CardMode } from '../../common/enums/card-mode.js';
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
   *
   * A modalidade e obrigatória porque e ela que escolhe a coluna da tabela de
   * taxas, e as duas colunas dão parcelas diferentes. Não ha padrão razoável
   * a assumir: quem ainda não sabe por onde o cartão vai ser cobrado ainda
   * não tem parcela nenhuma para mostrar.
   */
  async buildOptions(totalCents: number, mode: CardMode): Promise<InstallmentOption[]> {
    const settings = await this.payments.current();

    if (!settings.acceptsCard) {
      return [];
    }

    return buildInstallmentOptions(totalCents, toInstallmentRules(settings, mode));
  }
}
