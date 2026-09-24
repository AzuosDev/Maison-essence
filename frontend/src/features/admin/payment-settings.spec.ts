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
 * Tres coisas erram em silencio aqui, e as tres custam dinheiro de um jeito
 * direto:
 *
 * - **a chave PIX conferida contra o tipo errado** manda o cliente digitar
 *   onze digitos onde esta gravado um e-mail. A transferencia nao acontece e
 *   ninguem descobre pelo painel — descobre pelo cliente que desistiu;
 * - **o percentual lido com `parseFloat`** vira `1.9900000000000002` e o
 *   servidor recusa o `PATCH` por passar de duas casas;
 * - **a normalizacao divergindo do backend** faz o campo se achar sujo a cada
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

test('o telefone ganha o codigo do pais, como no banco', () => {
  expect(normalizePixKey('(88) 99999-9999', 'phone')).toBe('+5588999999999');
  expect(normalizePixKey('+55 88 99999-9999', 'phone')).toBe('+5588999999999');
});

test('o e-mail e a chave aleatoria descem para minuscula', () => {
  expect(normalizePixKey('Loja@Exemplo.com.BR', 'email')).toBe('loja@exemplo.com.br');
  expect(normalizePixKey('3F2B1C4D-5E6F-4A7B-8C9D-0E1F2A3B4C5D', 'random')).toBe(
    '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  );
});

test('chave vazia e valida: e a loja que ainda nao configurou', () => {
  expect(normalizePixKey('', 'cpf')).toBe('');
  expect(validatePayment(draft({ pixKey: '' })).pixKey).toBeUndefined();
});

test('a chave gravada volta pontuada, e a pontuacao desfaz sem sobra', () => {
  // A dona confere a chave olhando. Onze digitos corridos ninguem confere.
  expect(prettyPixKey('12345678901', 'cpf')).toBe('123.456.789-01');
  expect(prettyPixKey('12345678000190', 'cnpj')).toBe('12.345.678/0001-90');
  expect(prettyPixKey('+5588999999999', 'phone')).toBe('+55 (88) 99999-9999');

  for (const type of ['cpf', 'cnpj', 'phone'] as const) {
    const saved = { cpf: '12345678901', cnpj: '12345678000190', phone: '+5588999999999' }[type];

    expect(normalizePixKey(prettyPixKey(saved, type), type)).toBe(saved);
  }
});

/* ---- A validacao ------------------------------------------------------------- */

test('um rascunho vindo do servidor passa', () => {
  expect(hasPaymentErrors(validatePayment(draft()))).toBe(false);
});

test('sem juros ate mais parcelas do que a loja parcela nao significa nada', () => {
  // A mesma recusa do schema, antecipada: o servidor devolveria 422.
  expect(validatePayment(draft({ interestFreeUpTo: '18' })).interestFreeUpTo).toBeDefined();
  expect(validatePayment(draft({ interestFreeUpTo: '12' })).interestFreeUpTo).toBeUndefined();
});

test('os tetos do servidor valem aqui tambem', () => {
  expect(validatePayment(draft({ maxInstallments: '36' })).maxInstallments).toBeDefined();
  expect(validatePayment(draft({ pixDiscount: '80' })).pixDiscount).toBeDefined();
  expect(validatePayment(draft({ monthlyInterest: '25' })).monthlyInterest).toBeDefined();
});

test('zero passa em tudo que aceita zero, e vazio nao passa em nada', () => {
  // Zero e uma decisao: "nao dou desconto", "nao cobro juros", "nao tenho
  // parcela minima". Vazio nao diz nada.
  expect(hasPaymentErrors(validatePayment(draft({ pixDiscount: '0', monthlyInterest: '0' })))).toBe(
    false,
  );
  expect(validatePayment(draft({ minInstallment: '' })).minInstallment).toBeDefined();
  expect(validatePayment(draft({ pixDiscount: '' })).pixDiscount).toBeDefined();
});

test('desconto quebrado nao passa: o servidor so aceita percentual inteiro', () => {
  expect(validatePayment(draft({ pixDiscount: '5,5' })).pixDiscount).toBeDefined();
});

test('o campo de parcelas nao aceita numero pela metade', () => {
  // `Number.parseInt` leria `12x` como `12`, e o `PATCH` sairia com um valor
  // que a dona nao digitou.
  expect(validatePayment(draft({ maxInstallments: '12x' })).maxInstallments).toBeDefined();
});

/* ---- Os avisos ----------------------------------------------------------------- */

test('PIX ligado sem chave avisa, mas nao impede de salvar', () => {
  const semChave = draft({ pixKey: '' });

  expect(warningsOf(semChave).some((warning) => warning.scope === 'pix')).toBe(true);
  expect(hasPaymentErrors(validatePayment(semChave))).toBe(false);
});

test('as duas formas desligadas avisam a loja inteira', () => {
  const avisos = warningsOf(draft({ acceptsPix: false, acceptsCard: false }));

  expect(avisos.some((warning) => warning.scope === 'store')).toBe(true);
});

test('juros que nunca sao cobrados avisam', () => {
  // Sem juros ate 12, parcela ate 12: a taxa esta cadastrada e nao alcanca
  // nenhuma parcela.
  const avisos = warningsOf(draft({ maxInstallments: '12', interestFreeUpTo: '12' }));

  expect(avisos.some((warning) => warning.scope === 'card')).toBe(true);
});

test('a configuracao que veio do servidor nao gera aviso nenhum', () => {
  expect(warningsOf(draft())).toEqual([]);
});

/* ---- O diff -------------------------------------------------------------------- */

test('abrir a tela e nao mexer em nada nao gera chamada', () => {
  expect(changesOf(draft(), settings())).toBeNull();
});

test('a pontuacao da chave nao conta como mudanca', () => {
  // Sem isto, a tela reenviaria a mesma chave a cada salvamento, para sempre.
  expect(changesOf(draft({ pixKey: '123.456.789-01' }), settings())).toBeNull();
});

test('so o campo alterado viaja', () => {
  expect(changesOf(draft({ monthlyInterest: '2,49' }), settings())).toEqual({
    monthlyInterestPercent: 2.49,
  });
});

test('trocar so o tipo manda a chave junto', () => {
  // O servidor confere o par. Um `PATCH` so com o tipo o obrigaria a
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

/* ---- A previa ------------------------------------------------------------------ */

test('a previa le o rascunho, e nao o que esta salvo', () => {
  // E o que a faz ser ao vivo: a dona ve o efeito antes de decidir salvar.
  expect(previewCard(draft({ maxInstallments: '6' }))?.maxInstallments).toBe(6);
});

test('a previa some com o cartao desligado', () => {
  expect(previewCard(draft({ acceptsCard: false }))).toBeNull();
});

test('a previa some enquanto o numero ainda nao e numero', () => {
  expect(previewCard(draft({ monthlyInterest: '' }))).toBeNull();
  expect(previewCard(draft({ maxInstallments: '' }))).toBeNull();
});

test('o limite sem juros e aparado pelo maximo de parcelas', () => {
  // O rascunho "sem juros ate 12, parcela ate 6" e recusado na validacao, mas
  // existe no meio da digitacao — e sem o aparo a previa anunciaria juros
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

test('a previa do PIX some com o PIX desligado', () => {
  expect(pixPreview(draft({ acceptsPix: false }), 30_000)).toBeNull();
});

test('o desconto arredonda a favor de quem paga', () => {
  // 5% de R$ 99,99 sao R$ 4,9995, e o cliente leva os cinco centavos —
  // mesma escolha do backend.
  expect(pixPreview(draft(), 9999)?.discountCents).toBe(500);
});

test('uma chave escrita errada conta como pendencia, ainda que nao haja o que mandar', () => {
  // Sem isto, digitar um e-mail no campo marcado como CPF nao produziria
  // mudanca nenhuma — e a tela nao reagiria de jeito nenhum.
  const errada = draft({ pixKey: 'loja@exemplo.com.br' });

  expect(changesOf(errada, settings())).toBeNull();
  expect(isDirty(errada, settings())).toBe(true);
});

test('o que veio do servidor nao esta pendente', () => {
  expect(isDirty(draft(), settings())).toBe(false);
});
