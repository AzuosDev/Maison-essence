import { FULFILLMENT_MODES } from '../../common/enums/fulfillment-mode.js';
import { PAYMENT_METHODS } from '../../common/enums/payment-method.js';
import { buildWhatsappMessage, whatsappUrlOf } from './whatsapp-message.js';
import type { WhatsappOrder } from './whatsapp-message.js';

/** Um pedido completo: dois itens, desconto, entrega e cartao parcelado. */
function order(overrides: Partial<WhatsappOrder> = {}): WhatsappOrder {
  return {
    code: 'ME-250921-4KP1',
    items: [
      {
        productName: 'Asad',
        variantLabel: '100 ml',
        quantity: 3,
        unitPriceCents: 19_990,
        discountPercent: 10,
        discountCents: 5_997,
        lineTotalCents: 53_973,
      },
      {
        productName: 'Vela Perfumada',
        variantLabel: '',
        quantity: 1,
        unitPriceCents: 4_500,
        discountPercent: 0,
        discountCents: 0,
        lineTotalCents: 4_500,
      },
    ],
    customer: { name: 'Maria Silva', phone: '88999999999' },
    fulfillment: {
      mode: FULFILLMENT_MODES.DELIVERY,
      cityName: 'Sobral',
      state: 'CE',
      estimatedDays: 2,
      feeCents: 1_500,
      freeReason: '',
      address: {
        street: 'Rua das Flores',
        number: '123',
        complement: 'Apto 2',
        district: 'Centro',
        zipCode: '62000-000',
        reference: 'perto da praça',
      },
      pickupInstructions: '',
    },
    payment: {
      method: PAYMENT_METHODS.CARD,
      installments: 3,
      installmentCents: 19_991,
      firstInstallmentCents: 19_991,
      hasInterest: false,
      financedTotalCents: 59_973,
    },
    totals: {
      subtotalCents: 58_473,
      discountTotalCents: 5_997,
      deliveryFeeCents: 1_500,
      pixDiscountCents: 0,
      totalCents: 59_973,
    },
    ...overrides,
  };
}

describe('buildWhatsappMessage', () => {
  /**
   * O layout inteiro, comparado linha a linha.
   *
   * Um teste de texto e o unico que diz a verdade sobre um mockup: o que esta
   * escrito aqui e exatamente o que chega na tela do celular da dona, com as
   * mesmas quebras e os mesmos negritos.
   */
  it('monta a mensagem no layout do mockup', () => {
    expect(buildWhatsappMessage(order())).toBe(
      [
        '*NOVO PEDIDO* ME-250921-4KP1',
        '',
        '*ITENS*',
        '1. Asad - 100 ml',
        '   3 x R$ 199,90 = R$ 599,70',
        '   Desconto 10%: -R$ 59,97',
        '2. Vela Perfumada',
        '   1 x R$ 45,00 = R$ 45,00',
        '',
        '*RESUMO*',
        'Subtotal: R$ 644,70',
        'Desconto: -R$ 59,97',
        'Entrega: R$ 15,00',
        '*TOTAL: R$ 599,73*',
        '',
        '*PAGAMENTO*',
        'Cartão em 3x de R$ 199,91 sem juros',
        '',
        '*ENTREGA*',
        'Entrega em Sobral/CE (prazo de 2 dias úteis)',
        'Rua das Flores, 123 - Apto 2',
        'Bairro: Centro',
        'CEP: 62000-000',
        'Referência: perto da praça',
        '',
        '*CLIENTE*',
        'Maria Silva',
        '(88) 99999-9999',
      ].join('\n'),
    );
  });

  it('o subtotal mais os ajustes fecham no total', () => {
    // A conta que a dona faz no papel quando o cliente questiona.
    const message = buildWhatsappMessage(order());

    expect(message).toContain('Subtotal: R$ 644,70');
    expect(message).toContain('Desconto: -R$ 59,97');
    expect(message).toContain('Entrega: R$ 15,00');
    expect(message).toContain('*TOTAL: R$ 599,73*');
    expect(644_70 - 59_97 + 15_00).toBe(599_73);
  });

  it('não escreve linha de desconto quando não houve desconto', () => {
    const semDesconto = order({
      items: [
        {
          productName: 'Asad',
          variantLabel: '100 ml',
          quantity: 1,
          unitPriceCents: 19_990,
          discountPercent: 0,
          discountCents: 0,
          lineTotalCents: 19_990,
        },
      ],
      totals: {
        subtotalCents: 19_990,
        discountTotalCents: 0,
        deliveryFeeCents: 1_500,
        pixDiscountCents: 0,
        totalCents: 21_490,
      },
    });

    expect(buildWhatsappMessage(semDesconto)).not.toContain('Desconto');
  });

  it('avisa a retirada em vez de inventar endereço', () => {
    const retirada = order({
      fulfillment: {
        mode: FULFILLMENT_MODES.PICKUP,
        cityName: '',
        state: '',
        estimatedDays: 0,
        feeCents: 0,
        freeReason: 'retirada na loja',
        address: null,
        pickupInstructions: 'Rua da Loja, 10 - falar com Ana',
      },
    });
    const message = buildWhatsappMessage(retirada);

    expect(message).toContain('*ENTREGA*\nRetirada na loja\nRua da Loja, 10 - falar com Ana');
    // Na retirada nao ha taxa a exibir: a linha nao aparece zerada.
    expect(message).not.toContain('Entrega: ');
  });

  it('escreve a isenção com o motivo', () => {
    const gratis = order({
      fulfillment: { ...order().fulfillment, feeCents: 0, freeReason: 'pedido acima de R$ 150,00' },
      totals: { ...order().totals, deliveryFeeCents: 0, totalCents: 58_473 },
    });

    expect(buildWhatsappMessage(gratis)).toContain('Entrega: grátis (pedido acima de R$ 150,00)');
  });

  it('mostra o desconto do PIX e o pagamento a vista', () => {
    const pix = order({
      payment: {
        method: PAYMENT_METHODS.PIX,
        installments: 1,
        installmentCents: 0,
        firstInstallmentCents: 0,
        hasInterest: false,
        financedTotalCents: 57_050,
      },
      totals: { ...order().totals, pixDiscountCents: 2_923, totalCents: 57_050 },
    });
    const message = buildWhatsappMessage(pix);

    expect(message).toContain('Desconto PIX: -R$ 29,23');
    expect(message).toContain('*PAGAMENTO*\nPIX a vista');
  });

  it('avisa a primeira parcela quando ela difere das outras', () => {
    const quebrado = order({
      payment: { ...order().payment, installmentCents: 19_990, firstInstallmentCents: 19_993 },
    });

    expect(buildWhatsappMessage(quebrado)).toContain(
      'Cartão em 3x de R$ 199,90 sem juros (primeira de R$ 199,93)',
    );
  });

  it('diz o total financiado quando há juros', () => {
    const comJuros = order({
      payment: { ...order().payment, hasInterest: true, financedTotalCents: 62_000 },
    });

    expect(buildWhatsappMessage(comJuros)).toContain(
      'Cartão em 3x de R$ 199,91 com juros (total R$ 620,00)',
    );
  });

  it('omite os pedacos do endereço que o cliente não preencheu', () => {
    const magro = order({
      fulfillment: {
        ...order().fulfillment,
        estimatedDays: 1,
        address: {
          street: 'Rua das Flores',
          number: '',
          complement: '',
          district: 'Centro',
          zipCode: '',
          reference: '',
        },
      },
    });
    const message = buildWhatsappMessage(magro);

    expect(message).toContain(
      'Entrega em Sobral/CE (prazo de 1 dia útil)\nRua das Flores\nBairro: Centro\n',
    );
    expect(message).not.toContain('CEP');
    expect(message).not.toContain('Referência');
  });
});

describe('whatsappUrlOf', () => {
  it('codifica a mensagem preservando as quebras de linha', () => {
    const url = whatsappUrlOf('5588999999999', 'Linha 1\nLinha 2');

    expect(url).toBe('https://wa.me/5588999999999?text=Linha%201%0ALinha%202');
  });

  it('sem número cadastrado, não há link', () => {
    // Melhor nenhum link do que um `wa.me/` que abre o aplicativo num erro.
    expect(whatsappUrlOf('', 'Pedido')).toBe('');
  });
});
