import { InstallmentService } from './installment.service.js';
import type { PaymentsService } from './payments.service.js';
import type { PaymentSettingsDocument } from './schemas/payment-settings.schema.js';

/**
 * As regras de pagamento como o servico as le, sem Mongo no caminho.
 *
 * O `InstallmentService` so precisa de quatro numeros e de um booleano do
 * documento de configuracoes; montar um documento Mongoose inteiro para
 * entrega-los transformaria um teste de conta em um teste de banco.
 */
function settingsWith(overrides: Partial<PaymentSettingsDocument> = {}): PaymentSettingsDocument {
  return {
    acceptsCard: true,
    maxInstallments: 12,
    interestFreeUpTo: 3,
    monthlyInterestPercent: 0,
    minInstallmentCents: 0,
    ...overrides,
  } as PaymentSettingsDocument;
}

function serviceWith(settings: PaymentSettingsDocument): InstallmentService {
  const payments = { current: () => Promise.resolve(settings) } as unknown as PaymentsService;

  return new InstallmentService(payments);
}

describe('InstallmentService', () => {
  it('nao oferece parcela nenhuma quando a loja nao aceita cartao', async () => {
    const service = serviceWith(settingsWith({ acceptsCard: false }));

    // Lista vazia, e nao uma opcao a vista: quem chama nao precisa perguntar
    // antes se pode perguntar.
    await expect(service.buildOptions(50_000)).resolves.toEqual([]);
  });

  it('para no maximo de parcelas configurado', async () => {
    const service = serviceWith(settingsWith({ maxInstallments: 6 }));

    const options = await service.buildOptions(60_000);

    expect(options.map((option) => option.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('omite a opcao cuja parcela cai abaixo do minimo', async () => {
    const service = serviceWith(settingsWith({ minInstallmentCents: 2_000 }));

    const options = await service.buildOptions(10_000);

    // R$ 100 com parcela minima de R$ 20: de 1x a 5x, e nada alem disso.
    expect(options.map((option) => option.number)).toEqual([1, 2, 3, 4, 5]);
    expect(options.every((option) => option.installmentCents >= 2_000)).toBe(true);
  });

  it('cobra juros so acima do limite sem juros', async () => {
    const service = serviceWith(
      settingsWith({ interestFreeUpTo: 3, monthlyInterestPercent: 1.99 }),
    );

    const options = await service.buildOptions(90_000);
    const byNumber = new Map(options.map((option) => [option.number, option]));

    expect(byNumber.get(3)?.hasInterest).toBe(false);
    expect(byNumber.get(3)?.totalCents).toBe(90_000);
    expect(byNumber.get(4)?.hasInterest).toBe(true);
    expect(byNumber.get(4)?.totalCents).toBeGreaterThan(90_000);
  });

  it('a soma das parcelas fecha exatamente com o total, com e sem juros', async () => {
    const service = serviceWith(
      settingsWith({ maxInstallments: 12, interestFreeUpTo: 3, monthlyInterestPercent: 2.5 }),
    );

    // Valores escolhidos por darem divisao inexata: 100 / 3, 100,01 / 6,
    // 999,99 / 7. E onde o centavo se perde quando alguem soma float.
    for (const totalCents of [10_000, 10_001, 99_999, 1, 33_333]) {
      const options = await service.buildOptions(totalCents);

      for (const option of options) {
        const sum =
          option.firstInstallmentCents + option.installmentCents * (option.number - 1);

        expect(sum).toBe(option.totalCents);
        // A sobra vai para a primeira parcela, nunca para a ultima, e nunca
        // inverte a ordem: a primeira e a maior, ou igual as outras.
        expect(option.firstInstallmentCents).toBeGreaterThanOrEqual(option.installmentCents);
      }
    }
  });

  it('sem juros, o que o cliente paga em 12x e o mesmo que a vista', async () => {
    const service = serviceWith(
      settingsWith({ interestFreeUpTo: 12, monthlyInterestPercent: 3 }),
    );

    const options = await service.buildOptions(45_670);

    expect(options.every((option) => option.totalCents === 45_670)).toBe(true);
  });
});
