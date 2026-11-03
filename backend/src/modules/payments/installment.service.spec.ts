import { CARD_MODES } from '../../common/enums/card-mode.js';
import { CARD_PLANS } from '../../common/enums/card-plan.js';
import { InstallmentService } from './installment.service.js';
import type { PaymentsService } from './payments.service.js';
import type { CardRate, PaymentSettingsDocument } from './schemas/payment-settings.schema.js';

/**
 * Uma tabela de taxas com as duas colunas separadas por um valor fixo.
 *
 * O link cobra `percent` e o tap cobra metade disso. Os números não são os da
 * operadora de propósito: o que estes testes verificam e que a coluna certa e
 * consultada, e uma diferença grande e redonda entre as duas e o que faz a
 * troca de coluna aparecer no valor em vez de se esconder no arredondamento.
 */
function ratesOf(percentByInstallments: Record<number, number>): CardRate[] {
  return Object.entries(percentByInstallments).map(([installments, percent]) => ({
    installments: Number(installments),
    linkPercent: percent,
    tapPercent: percent / 2,
  })) as CardRate[];
}

const RATES = ratesOf({ 1: 4, 2: 6, 3: 8, 4: 10, 5: 10, 6: 10, 7: 20, 8: 20, 9: 20, 10: 20, 11: 20, 12: 20 });

/** A mesma tabela do Nitro: o dobro da taxa, para a troca aparecer no valor. */
const NITRO_RATES = ratesOf({ 1: 8, 2: 12, 3: 16, 4: 20, 5: 20, 6: 20, 7: 40, 8: 40, 9: 40, 10: 40, 11: 40, 12: 40 });

/**
 * As regras de pagamento como o serviço as lê, sem Mongo no caminho.
 *
 * O `InstallmentService` só precisa de alguns campos do documento de
 * configurações; montar um documento Mongoose inteiro para entrega-los
 * transformaria um teste de conta em um teste de banco.
 */
function settingsWith(overrides: Partial<PaymentSettingsDocument> = {}): PaymentSettingsDocument {
  return {
    acceptsCard: true,
    maxInstallments: 12,
    interestFreeUpTo: 3,
    cardRates: RATES,
    nitroCardRates: NITRO_RATES,
    activeCardPlan: CARD_PLANS.STANDARD,
    minInstallmentCents: 0,
    ...overrides,
  } as PaymentSettingsDocument;
}

function serviceWith(settings: PaymentSettingsDocument): InstallmentService {
  const payments = { current: () => Promise.resolve(settings) } as unknown as PaymentsService;

  return new InstallmentService(payments);
}

describe('InstallmentService', () => {
  it('não oferece parcela nenhuma quando a loja não aceita cartão', async () => {
    const service = serviceWith(settingsWith({ acceptsCard: false }));

    // Lista vazia, e não uma opção a vista: quem chama não precisa perguntar
    // antes se pode perguntar.
    await expect(service.buildOptions(50_000, CARD_MODES.LINK)).resolves.toEqual([]);
  });

  it('para no máximo de parcelas configurado', async () => {
    const service = serviceWith(settingsWith({ maxInstallments: 6 }));

    const options = await service.buildOptions(60_000, CARD_MODES.LINK);

    expect(options.map((option) => option.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('omite a opção cuja parcela cai abaixo do mínimo', async () => {
    const service = serviceWith(settingsWith({ minInstallmentCents: 2_000 }));

    const options = await service.buildOptions(10_000, CARD_MODES.LINK);

    // R$ 100 com parcela mínima de R$ 20: de 1x a 5x, e nada além disso.
    expect(options.map((option) => option.number)).toEqual([1, 2, 3, 4, 5]);
    expect(options.every((option) => option.installmentCents >= 2_000)).toBe(true);
  });

  it('cobra juros só acima do limite que a loja absorve', async () => {
    const service = serviceWith(settingsWith({ interestFreeUpTo: 3 }));

    const options = await service.buildOptions(90_000, CARD_MODES.LINK);
    const byNumber = new Map(options.map((option) => [option.number, option]));

    expect(byNumber.get(3)?.hasInterest).toBe(false);
    expect(byNumber.get(3)?.totalCents).toBe(90_000);
    expect(byNumber.get(4)?.hasInterest).toBe(true);
    expect(byNumber.get(4)?.totalCents).toBeGreaterThan(90_000);
  });

  /**
   * O motivo de a modalidade existir: a mesma compra, nas mesmas parcelas,
   * custa valores diferentes conforme o cartão seja cobrado pelo link ou na
   * maquininha. Se este teste passar com os dois iguais, a coluna da tabela
   * não esta sendo escolhida por ninguém.
   */
  it('cobra a coluna da modalidade escolhida', async () => {
    const service = serviceWith(settingsWith());

    const link = await service.buildOptions(100_000, CARD_MODES.LINK);
    const tap = await service.buildOptions(100_000, CARD_MODES.TAP);

    const seisNoLink = link.find((option) => option.number === 6);
    const seisNoTap = tap.find((option) => option.number === 6);

    // 10% no link, 5% na maquininha.
    expect(seisNoLink?.totalCents).toBe(111_111);
    expect(seisNoTap?.totalCents).toBe(105_263);
  });

  it('o limite absorvido vale para as duas modalidades', async () => {
    const service = serviceWith(settingsWith({ interestFreeUpTo: 3 }));

    for (const mode of [CARD_MODES.LINK, CARD_MODES.TAP]) {
      const options = await service.buildOptions(90_000, mode);
      const tres = options.find((option) => option.number === 3);

      expect(tres?.totalCents).toBe(90_000);
      expect(tres?.hasInterest).toBe(false);
    }
  });

  /**
   * O plano trocado no painel muda o preço do pedido seguinte, sem que a
   * cotação saiba que existem dois planos: ela pede a tabela e recebe a que
   * esta em uso.
   */
  it('cota pela tabela do plano ativo', async () => {
    const padrao = serviceWith(settingsWith());
    const nitro = serviceWith(settingsWith({ activeCardPlan: CARD_PLANS.NITRO }));

    const seisNoPadrao = (await padrao.buildOptions(100_000, CARD_MODES.LINK)).find(
      (option) => option.number === 6,
    );
    const seisNoNitro = (await nitro.buildOptions(100_000, CARD_MODES.LINK)).find(
      (option) => option.number === 6,
    );

    // 10% contra 20%: a cliente paga R$ 1.111,11 ou R$ 1.250,00 pela mesma
    // compra, e a diferença e a antecipação que a loja contratou.
    expect(seisNoPadrao?.totalCents).toBe(111_111);
    expect(seisNoNitro?.totalCents).toBe(125_000);
  });

  /**
   * O estado que o schema recusa, documentado aqui pelo que ele causaria: com
   * o Nitro ativo e a tabela dele vazia, sobram só as parcelas que a loja
   * absorve — sem erro em lugar nenhum, porque taxa que falta esconde a
   * parcela por desenho.
   */
  it('plano ativo sem tabela deixa só as parcelas absorvidas', async () => {
    const service = serviceWith(
      settingsWith({ activeCardPlan: CARD_PLANS.NITRO, nitroCardRates: [] }),
    );

    const options = await service.buildOptions(100_000, CARD_MODES.LINK);

    expect(options.map((option) => option.number)).toEqual([1, 2, 3]);
  });

  it('a soma das parcelas fecha exatamente com o total, com e sem juros', async () => {
    const service = serviceWith(settingsWith({ maxInstallments: 12, interestFreeUpTo: 3 }));

    // Valores escolhidos por darem divisão inexata: 100 / 3, 100,01 / 6,
    // 999,99 / 7. E onde o centavo se perde quando alguém soma float.
    for (const totalCents of [10_000, 10_001, 99_999, 1, 33_333]) {
      for (const mode of [CARD_MODES.LINK, CARD_MODES.TAP]) {
        const options = await service.buildOptions(totalCents, mode);

        for (const option of options) {
          const sum =
            option.firstInstallmentCents + option.installmentCents * (option.number - 1);

          expect(sum).toBe(option.totalCents);
          // A sobra vai para a primeira parcela, nunca para a última, e
          // nunca inverte a ordem: a primeira e a maior, ou igual as outras.
          expect(option.firstInstallmentCents).toBeGreaterThanOrEqual(option.installmentCents);
        }
      }
    }
  });

  it('absorvendo tudo, o que o cliente paga em 12x e o mesmo que a vista', async () => {
    const service = serviceWith(settingsWith({ interestFreeUpTo: 12 }));

    const options = await service.buildOptions(45_670, CARD_MODES.LINK);

    expect(options.every((option) => option.totalCents === 45_670)).toBe(true);
  });
});
