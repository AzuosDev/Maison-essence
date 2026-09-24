import { expect, test } from 'vitest';
import type { AdminPaymentSettings } from './admin.types';
import {
  changesOf,
  draftFromSettings,
  hasPaymentErrors,
  isDirty,
  normalizePixKey,
  percentFromInput,
  percentToInput,
  pixPreview,
  prettyPixKey,
  previewCard,
  validatePayment,
  warningsOf,
  type PaymentDraft,
} from './payment-settings';

/**
 * As regras de pagamento.
 *
 * Três coisas erram em silêncio aqui, e as três custam dinheiro de um jeito
 * direto:
 *
 * - **a chave PIX conferida contra o tipo errado** manda o cliente digitar
 *   onze digitos onde esta gravado um e-mail. A transferência não acontece e
 *   ninguém descobre pelo painel — descobre pelo cliente que desistiu;
 * - **o percentual lido com `parseFloat`** vira `1.9900000000000002` e o
 *   servidor recusa o `PATCH` por passar de duas casas;
 * - **a normalização divergindo do backend** faz o campo se achar sujo a cada
 *   abertura e reenviar o mesmo valor para sempre.
 */

function settings(patch: Partial<AdminPaymentSettings> = {}): AdminPaymentSettings {
  return {
    acceptsPix: true,
    pixKey: '12345678901',
    pixKeyType: 'cpf',
    pixDiscountPercent: 5,
    acceptsCard: true,
    maxInstallments: 12,
    interestFreeUpTo: 6,
    monthlyInterestPercent: 1.99,
    minInstallmentCents: 2000,
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...patch,
  };
}

function draft(patch: Partial<PaymentDraft> = {}): PaymentDraft {
  return { ...draftFromSettings(settings()), ...patch };
}

/* ---- A chave PIX ------------------------------------------------------------- */

test('a chave e conferida contra o tipo escolhido', () => {
  expect(normalizePixKey('123.456.789-01', 'cpf')).toBe('12345678901');
  expect(normalizePixKey('loja@exemplo.com.br', 'cpf')).toBeNull();
  expect(normalizePixKey('12345678901', 'email')).toBeNull();
});

test('o telefone ganha o código do pais, como no banco', () => {
  expect(normalizePixKey('(88) 99999-9999', 'phone')).toBe('+5588999999999');
  expect(normalizePixKey('+55 88 99999-9999', 'phone')).toBe('+5588999999999');
});

test('o e-mail e a chave aleatória descem para minúscula', () => {
  expect(normalizePixKey('Loja@Exemplo.com.BR', 'email')).toBe('loja@exemplo.com.br');
  expect(normalizePixKey('3F2B1C4D-5E6F-4A7B-8C9D-0E1F2A3B4C5D', 'random')).toBe(
    '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  );
});

test('chave vazia e valida: e a loja que ainda não configurou', () => {
  expect(normalizePixKey('', 'cpf')).toBe('');
  expect(validatePayment(draft({ pixKey: '' })).pixKey).toBeUndefined();
});

test('a chave gravada volta pontuada, e a pontuação desfaz sem sobra', () => {
  // A dona confere a chave olhando. Onze digitos corridos ninguém confere.
  expect(prettyPixKey('12345678901', 'cpf')).toBe('123.456.789-01');
  expect(prettyPixKey('12345678000190', 'cnpj')).toBe('12.345.678/0001-90');
  expect(prettyPixKey('+5588999999999', 'phone')).toBe('+55 (88) 99999-9999');

  for (const type of ['cpf', 'cnpj', 'phone'] as const) {
    const saved = { cpf: '12345678901', cnpj: '12345678000190', phone: '+5588999999999' }[type];

    expect(normalizePixKey(prettyPixKey(saved, type), type)).toBe(saved);
  }
});

/* ---- A validação ------------------------------------------------------------- */

test('um rascunho vindo do servidor passa', () => {
  expect(hasPaymentErrors(validatePayment(draft()))).toBe(false);
});

test('sem juros até mais parcelas do que a loja parcela não significa nada', () => {
  // A mesma recusa do schema, antecipada: o servidor devolveria 422.
  expect(validatePayment(draft({ interestFreeUpTo: '18' })).interestFreeUpTo).toBeDefined();
  expect(validatePayment(draft({ interestFreeUpTo: '12' })).interestFreeUpTo).toBeUndefined();
});

test('os tetos do servidor valem aqui também', () => {
  expect(validatePayment(draft({ maxInstallments: '36' })).maxInstallments).toBeDefined();
  expect(validatePayment(draft({ pixDiscount: '80' })).pixDiscount).toBeDefined();
  expect(validatePayment(draft({ monthlyInterest: '25' })).monthlyInterest).toBeDefined();
});

test('zero passa em tudo que aceita zero, e vazio não passa em nada', () => {
  // Zero e uma decisão: "não dou desconto", "não cobro juros", "não tenho
  // parcela mínima". Vazio não diz nada.
  expect(hasPaymentErrors(validatePayment(draft({ pixDiscount: '0', monthlyInterest: '0' })))).toBe(
    false,
  );
  expect(validatePayment(draft({ minInstallment: '' })).minInstallment).toBeDefined();
  expect(validatePayment(draft({ pixDiscount: '' })).pixDiscount).toBeDefined();
});

test('desconto quebrado não passa: o servidor só aceita percentual inteiro', () => {
  expect(validatePayment(draft({ pixDiscount: '5,5' })).pixDiscount).toBeDefined();
});

test('o campo de parcelas não aceita número pela metade', () => {
  // `Number.parseInt` leria `12x` como `12`, e o `PATCH` sairia com um valor
  // que a dona não digitou.
  expect(validatePayment(draft({ maxInstallments: '12x' })).maxInstallments).toBeDefined();
});

/* ---- Os avisos ----------------------------------------------------------------- */

test('PIX ligado sem chave avisa, mas não impede de salvar', () => {
  const semChave = draft({ pixKey: '' });

  expect(warningsOf(semChave).some((warning) => warning.scope === 'pix')).toBe(true);
  expect(hasPaymentErrors(validatePayment(semChave))).toBe(false);
});

test('as duas formas desligadas avisam a loja inteira', () => {
  const avisos = warningsOf(draft({ acceptsPix: false, acceptsCard: false }));

  expect(avisos.some((warning) => warning.scope === 'store')).toBe(true);
});

test('juros que nunca são cobrados avisam', () => {
  // Sem juros até 12, parcela até 12: a taxa esta cadastrada e não alcança
  // nenhuma parcela.
  const avisos = warningsOf(draft({ maxInstallments: '12', interestFreeUpTo: '12' }));

  expect(avisos.some((warning) => warning.scope === 'card')).toBe(true);
});

test('a configuração que veio do servidor não gera aviso nenhum', () => {
  expect(warningsOf(draft())).toEqual([]);
});

/* ---- O diff -------------------------------------------------------------------- */

test('abrir a tela e não mexer em nada não gera chamada', () => {
  expect(changesOf(draft(), settings())).toBeNull();
});

test('a pontuação da chave não conta como mudanca', () => {
  // Sem isto, a tela reenviaria a mesma chave a cada salvamento, para sempre.
  expect(changesOf(draft({ pixKey: '123.456.789-01' }), settings())).toBeNull();
});

test('só o campo alterado viaja', () => {
  expect(changesOf(draft({ monthlyInterest: '2,49' }), settings())).toEqual({
    monthlyInterestPercent: 2.49,
  });
});

test('trocar só o tipo manda a chave junto', () => {
  // O servidor confere o par. Um `PATCH` só com o tipo o obrigaria a
  // adivinhar contra qual chave conferir.
  const mudanca = changesOf(draft({ pixKeyType: 'random', pixKey: '' }), settings());

  expect(mudanca).toEqual({ pixKeyType: 'random', pixKey: '' });
});

test('os juros saem com duas casas exatas', () => {
  // `parseFloat('1,99'.replace(...))` sobrevive, mas qualquer conta em cima
  // dele produz a terceira casa que o servidor recusa.
  expect(percentFromInput('1,99')).toBe(1.99);
  expect(percentToInput(1.99)).toBe('1,99');
  expect(percentFromInput('2')).toBe(2);
  expect(percentFromInput('dois')).toBeNull();
});

/* ---- A prévia ------------------------------------------------------------------ */

test('a prévia lê o rascunho, e não o que esta salvo', () => {
  // E o que a faz ser ao vivo: a dona vê o efeito antes de decidir salvar.
  expect(previewCard(draft({ maxInstallments: '6' }))?.maxInstallments).toBe(6);
});

test('a prévia some com o cartão desligado', () => {
  expect(previewCard(draft({ acceptsCard: false }))).toBeNull();
});

test('a prévia some enquanto o número ainda não e número', () => {
  expect(previewCard(draft({ monthlyInterest: '' }))).toBeNull();
  expect(previewCard(draft({ maxInstallments: '' }))).toBeNull();
});

test('o limite sem juros e aparado pelo máximo de parcelas', () => {
  // O rascunho "sem juros até 12, parcela até 6" e recusado na validação, mas
  // existe no meio da digitação — e sem o aparo a prévia anunciaria juros
  // zero em tudo por causa de um estado que dura dois caracteres.
  expect(previewCard(draft({ maxInstallments: '6', interestFreeUpTo: '12' }))).toEqual({
    maxInstallments: 6,
    interestFreeUpTo: 6,
    monthlyInterestPercent: 1.99,
    minInstallmentCents: 2000,
  });
});

test('o desconto do PIX incide sobre o valor cheio', () => {
  expect(pixPreview(draft(), 30_000)).toEqual({ discountCents: 1500, totalCents: 28_500 });
});

test('a prévia do PIX some com o PIX desligado', () => {
  expect(pixPreview(draft({ acceptsPix: false }), 30_000)).toBeNull();
});

test('o desconto arredonda a favor de quem paga', () => {
  // 5% de R$ 99,99 são R$ 4,9995, e o cliente leva os cinco centavos —
  // mesma escolha do backend.
  expect(pixPreview(draft(), 9999)?.discountCents).toBe(500);
});

test('uma chave escrita errada conta como pendência, ainda que não haja o que mandar', () => {
  // Sem isto, digitar um e-mail no campo marcado como CPF não produziria
  // mudanca nenhuma — e a tela não reagiria de jeito nenhum.
  const errada = draft({ pixKey: 'loja@exemplo.com.br' });

  expect(changesOf(errada, settings())).toBeNull();
  expect(isDirty(errada, settings())).toBe(true);
});

test('o que veio do servidor não esta pendente', () => {
  expect(isDirty(draft(), settings())).toBe(false);
});
