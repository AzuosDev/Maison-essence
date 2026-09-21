import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AUDIT_ACTIONS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditActor } from '../audit/audit.types.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { diffOf } from '../settings/settings.diff.js';
import type { AuditSnapshot } from '../settings/settings.diff.js';
import type { Versioned } from '../settings/settings.service.js';
import type { UpdatePaymentSettingsDto } from './dto/update-payment-settings.dto.js';
import { toPaymentSettingsView, toPublicPaymentSettingsView } from './payment-settings.view.js';
import type {
  PaymentSettingsView,
  PublicPaymentSettingsView,
} from './payment-settings.view.js';
import { PIX_KEY_MESSAGES, maskPixKey, normalizePixKey } from './pix-key.js';
import { pixQuoteOf } from './pix-discount.js';
import type { PixQuote } from './pix-discount.js';
import { PaymentSettings } from './schemas/payment-settings.schema.js';
import type {
  PaymentSettingsDocument,
  PaymentSettingsModel,
} from './schemas/payment-settings.schema.js';

/** Campos de valor unico: o que veio substitui o que estava. */
const SCALARS = [
  'acceptsPix',
  'pixDiscountPercent',
  'acceptsCard',
  'maxInstallments',
  'interestFreeUpTo',
  'monthlyInterestPercent',
  'minInstallmentCents',
] as const;

/**
 * As regras de pagamento da loja.
 *
 * Nenhum pagamento e processado aqui, e isso nao e limitacao: e o desenho. A
 * loja informa o que aceita, o cliente paga por fora — PIX no aplicativo do
 * banco, cartao na maquininha ou no link que a dona manda — e o sistema so
 * precisa acertar as contas que aparecem antes disso.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentSettings.name) private readonly settings: PaymentSettingsModel,
    private readonly audit: AuditService,
  ) {}

  /**
   * O documento unico, criado com os padroes na primeira leitura.
   *
   * E por aqui que os outros modulos leem as regras: o calculo de parcelas e
   * o de desconto do PIX. Ler do banco a cada pedido, e nao de uma constante
   * do build, e o que faz um reajuste de juros valer no pedido seguinte.
   */
  current(): Promise<PaymentSettingsDocument> {
    return this.settings.getOrCreate();
  }

  async adminView(): Promise<PaymentSettingsView> {
    return toPaymentSettingsView(await this.current());
  }

  /** O subconjunto seguro: formas aceitas, sem a chave PIX. */
  async publicView(): Promise<Versioned<PublicPaymentSettingsView>> {
    const settings = await this.current();

    return { payload: toPublicPaymentSettingsView(settings), updatedAt: settings.updatedAt };
  }

  /**
   * Grava as regras e registra na auditoria o que mudou.
   *
   * Mesma trilha das configuracoes da loja, e pelo mesmo motivo: sao regras
   * que mexem no valor que o cliente paga. "Quem baixou a parcela minima?" e
   * "quando o desconto do PIX virou 15%?" sao perguntas que aparecem depois,
   * olhando um pedido antigo, e a resposta precisa estar em algum lugar.
   */
  async update(
    actor: AuthenticatedUser,
    dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsView> {
    const settings = await this.current();
    const before = auditSnapshot(settings);

    for (const field of SCALARS) {
      const value = dto[field];

      if (value !== undefined) {
        settings.set(field, value);
      }
    }

    this.applyPixKey(settings, dto);

    await settings.save();

    const changes = diffOf(before, auditSnapshot(settings));

    if (Object.keys(changes).length > 0) {
      await this.audit.record({
        action: AUDIT_ACTIONS.PAYMENT_SETTINGS_UPDATED,
        actor: toParty(actor),
        changes,
      });
    }

    return toPaymentSettingsView(settings);
  }

  /**
   * O desconto do PIX de um pedido.
   *
   * Recebe o subtotal e a entrega separados porque o desconto so incide sobre
   * o primeiro. Com o PIX desligado nao ha desconto nenhum — nem quando a
   * dona deixou um percentual gravado de uma promocao anterior.
   */
  async pixQuote(subtotalCents: number, deliveryFeeCents: number): Promise<PixQuote> {
    const settings = await this.current();

    return pixQuoteOf(
      subtotalCents,
      deliveryFeeCents,
      settings.acceptsPix ? settings.pixDiscountPercent : 0,
    );
  }

  /**
   * Aplica a chave PIX conferindo-a contra o tipo.
   *
   * A checagem roda tambem quando so o tipo mudou: trocar "e-mail" por "CPF"
   * sem trocar a chave deixaria gravado um par que o cliente nao consegue
   * usar, e a rota publica passaria a anunciar um tipo que nao corresponde ao
   * que esta la.
   */
  private applyPixKey(
    settings: PaymentSettingsDocument,
    dto: UpdatePaymentSettingsDto,
  ): void {
    if (dto.pixKey === undefined && dto.pixKeyType === undefined) {
      return;
    }

    const type = dto.pixKeyType ?? settings.pixKeyType;
    const normalized = normalizePixKey(dto.pixKey ?? settings.pixKey, type);

    if (normalized === null) {
      throw new UnprocessableEntityException(PIX_KEY_MESSAGES[type]);
    }

    settings.pixKey = normalized;
    settings.pixKeyType = type;
  }
}

/** Retrato das regras para a auditoria. Sem aninhamento: e tudo campo simples. */
function auditSnapshot(settings: PaymentSettingsDocument): AuditSnapshot {
  return {
    acceptsPix: settings.acceptsPix,
    // Mascarada: a trilha precisa mostrar que a chave mudou, e a chave
    // inteira num log e a conta para onde o dinheiro da loja vai.
    pixKey: maskPixKey(settings.pixKey),
    pixKeyType: settings.pixKeyType,
    pixDiscountPercent: settings.pixDiscountPercent,
    acceptsCard: settings.acceptsCard,
    maxInstallments: settings.maxInstallments,
    interestFreeUpTo: settings.interestFreeUpTo,
    monthlyInterestPercent: settings.monthlyInterestPercent,
    minInstallmentCents: settings.minInstallmentCents,
  };
}

function toParty(actor: AuthenticatedUser): AuditActor {
  return { id: actor.id, email: actor.email, role: actor.role };
}
