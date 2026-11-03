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
  planContrast,
  prettyPixKey,
  previewRules,
  validatePayment,
  warningsOf,
  type PaymentDraft,
  type RateDraft,
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
    cardRates: RATES,
    nitroCardRates: [],
    activeCardPlan: 'standard',
    minInstallmentCents: 2000,
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...patch,
  };
}

/**
 * Uma tabela inteira, com as duas colunas diferentes.
 *
 * Inteira porque linha faltando e aviso, e diferentes porque colunas iguais
 * também são — a configuração de partida destes testes não pode disparar
 * nenhum dos dois, ou todo caso de aviso passaria por acidente.
 */
const RATES = Array.from({ length: 12 }, (_, index) => ({
  installments: index + 1,
  linkPercent: 4 + index,
  tapPercent: 2 + index,
}));

/** A mesma tabela mais cara, que e o que o Nitro cobra por adiantar. */
const NITRO_RATES = RATES.map((rate) => ({
  installments: rate.installments,
  linkPercent: rate.linkPercent * 2,
  tapPercent: rate.tapPercent * 2,
}));

/** A tabela do rascunho com uma célula trocada. */
function withRate(rates: readonly RateDraft[], installments: number, cell: Partial<RateDraft>) {
  return rates.map((row) => (row.installments === installments ? { ...row, ...cell } : row));
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

  const acima = draft({ rates: withRate(draft().rates, 6, { link: '90' }) });

  expect(validatePayment(acima).rates?.[6]).toBeDefined();
});

/* ---- A tabela de taxas --------------------------------------------------------- */

test('linha inteira vazia passa: e a parcela que não e oferecida', () => {
  const semSeis = draft({ rates: withRate(draft().rates, 6, { link: '', tap: '' }) });

  expect(hasPaymentErrors(validatePayment(semSeis))).toBe(false);
});

/**
 * Meia linha não passa. As duas saídas possíveis seriam ruins: zero faz a
 * loja vender sem repassar a taxa, e omitir faz a parcela sumir só de um
 * lado — e a dona não veria nenhuma das duas acontecer.
 */
test('meia linha e erro, e o erro aponta a parcela', () => {
  const meia = draft({ rates: withRate(draft().rates, 8, { tap: '' }) });
  const errors = validatePayment(meia);

  expect(errors.rates?.[8]).toBeDefined();
  expect(errors.rates?.[7]).toBeUndefined();
});

test('taxa que não e número e erro', () => {
  const texto = draft({ rates: withRate(draft().rates, 4, { link: 'treze' }) });

  expect(validatePayment(texto).rates?.[4]).toBeDefined();
});

/**
 * A parcela sem taxa some do checkout sem dizer nada, e a lista encurtada na
 * prévia e o único sinal. Este aviso e o segundo.
 */
test('parcela sem taxa acima do limite absorvido avisa', () => {
  const faltando = draft({ rates: withRate(draft().rates, 9, { link: '', tap: '' }) });
  const avisos = warningsOf(faltando);

  expect(avisos.some((warning) => warning.text.includes('9x'))).toBe(true);
});

test('parcela sem taxa dentro do limite absorvido não avisa', () => {
  // Até o limite a cliente paga a etiqueta, e a taxa nem e consultada.
  const faltando = draft({ rates: withRate(draft().rates, 2, { link: '', tap: '' }) });

  expect(warningsOf(faltando)).toEqual([]);
});

/**
 * As duas colunas iguais são o estado em que a loja nasce — a tabela padrão
 * repete a do link na maquininha para nunca cobrar a menos —, e não uma
 * decisão. Enquanto estiver assim, quem paga na entrega paga a taxa do link.
 */
test('as duas colunas iguais avisam', () => {
  const iguais = draft({
    rates: draft().rates.map((row) => ({
      installments: row.installments,
      link: row.link,
      tap: row.link,
    })),
  });

  expect(iguais.rates.every((row) => row.link === row.tap)).toBe(true);
  expect(warningsOf(iguais).some((warning) => warning.text.includes('maquininha'))).toBe(true);
});

test('zero passa em tudo que aceita zero, e vazio não passa em nada', () => {
  // Zero e uma decisão: "não dou desconto", "não cobro juros", "não tenho
  // parcela mínima". Vazio não diz nada.
  expect(hasPaymentErrors(validatePayment(draft({ pixDiscount: '0' })))).toBe(false);
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

test('taxa que nunca e repassada avisa', () => {
  // Absorve até 12, parcela até 12: a tabela esta cadastrada e a loja paga
  // a conta de todas elas.
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
  expect(changesOf(draft({ minInstallment: '30,00' }), settings())).toEqual({
    minInstallmentCents: 3000,
  });
});

/**
 * A tabela sobe inteira, e não a linha mexida.
 *
 * Uma taxa reajustada vem no meio de uma tabela que a dona acabou de
 * conferir, e mandar só a linha obrigaria o servidor a adivinhar o que fazer
 * com uma parcela que sumiu do formulário: apagar ou manter.
 */
test('mexer numa taxa manda a tabela inteira', () => {
  const mudanca = changesOf(draft({ rates: withRate(draft().rates, 7, { link: '13,50' }) }), settings());

  expect(Object.keys(mudanca ?? {})).toEqual(['cardRates']);
  expect(mudanca?.cardRates).toHaveLength(12);
  expect(mudanca?.cardRates?.[6]).toEqual({
    installments: 7,
    linkPercent: 13.5,
    tapPercent: 8,
  });
});

test('linha apagada sai da tabela que viaja', () => {
  const mudanca = changesOf(
    draft({ rates: withRate(draft().rates, 12, { link: '', tap: '' }) }),
    settings(),
  );

  expect(mudanca?.cardRates).toHaveLength(11);
});

test('trocar só o tipo manda a chave junto', () => {
  // O servidor confere o par. Um `PATCH` só com o tipo o obrigaria a
  // adivinhar contra qual chave conferir.
  const mudanca = changesOf(draft({ pixKeyType: 'random', pixKey: '' }), settings());

  expect(mudanca).toEqual({ pixKeyType: 'random', pixKey: '' });
});

test('as taxas saem com duas casas exatas', () => {
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
  expect(previewRules(draft({ maxInstallments: '6' }))?.link.maxInstallments).toBe(6);
});

test('a prévia some com o cartão desligado', () => {
  expect(previewRules(draft({ acceptsCard: false }))).toBeNull();
});

test('a prévia some enquanto o número ainda não e número', () => {
  expect(previewRules(draft({ maxInstallments: '' }))).toBeNull();
  expect(previewRules(draft({ minInstallment: '' }))).toBeNull();
});

/** As duas colunas saem separadas: e a comparação que a prévia existe para mostrar. */
test('a prévia separa a taxa do link da taxa da maquininha', () => {
  const rules = previewRules(draft());

  expect(rules?.link.feePercents.get(7)).toBe(10);
  expect(rules?.tap.feePercents.get(7)).toBe(8);
});

test('célula pela metade fica de fora da prévia, como ficaria do PATCH', () => {
  const meia = draft({ rates: withRate(draft().rates, 7, { tap: '' }) });

  expect(previewRules(meia)?.link.feePercents.has(7)).toBe(false);
});

test('o limite sem juros e aparado pelo máximo de parcelas', () => {
  // O rascunho "sem juros até 12, parcela até 6" e recusado na validação, mas
  // existe no meio da digitação — e sem o aparo a prévia anunciaria juros
  // zero em tudo por causa de um estado que dura dois caracteres.
  const rules = previewRules(draft({ maxInstallments: '6', interestFreeUpTo: '12' }));

  expect(rules?.link.maxInstallments).toBe(6);
  expect(rules?.link.interestFreeUpTo).toBe(6);
  expect(rules?.tap.interestFreeUpTo).toBe(6);
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

/* ---- Os dois planos ------------------------------------------------------------- */

/**
 * O Nitro adianta o dinheiro da venda parcelada e cobra mais por isso.
 *
 * São duas tabelas gravadas e um interruptor, e o jeito de errar aqui e
 * mudo: plano ligado sem tabela não devolve erro nenhum no checkout — a
 * parcela sem taxa some da lista, e a loja passa a semana vendendo só a
 * vista sem nada na tela dizendo por que.
 */

/** O rascunho com a tabela do Nitro preenchida, que e o que destrava a troca. */
function comNitro(patch: Partial<PaymentDraft> = {}): PaymentDraft {
  return { ...draftFromSettings(settings({ nitroCardRates: NITRO_RATES })), ...patch };
}

test('o plano em uso escolhe a tabela que a prévia cota', () => {
  expect(previewRules(comNitro())?.link.feePercents.get(7)).toBe(10);
  expect(previewRules(comNitro({ activeCardPlan: 'nitro' }))?.link.feePercents.get(7)).toBe(20);
});

test('deixar em uso um plano sem tabela e erro', () => {
  const vazio = validatePayment(draft({ activeCardPlan: 'nitro' }));

  expect(vazio.activeCardPlan).toBeDefined();
  expect(validatePayment(comNitro({ activeCardPlan: 'nitro' })).activeCardPlan).toBeUndefined();
});

/**
 * A tabela parada sobe no mesmo `PATCH` e o servidor a confere igual. Sem um
 * mapa de erros próprio, a recusa marcaria a linha errada da tabela errada.
 */
test('a tabela do plano parado também e conferida, e no mapa dela', () => {
  const meia = validatePayment(draft({ nitroRates: withRate(draft().nitroRates, 7, { link: '13,50' }) }));

  expect(meia.nitroRates?.[7]).toBeDefined();
  expect(meia.rates).toBeUndefined();
});

test('mexer na tabela do Nitro não toca na padrão', () => {
  const mudanca = changesOf(
    draft({ nitroRates: withRate(draft().nitroRates, 1, { link: '8,40', tap: '8,92' }) }),
    settings(),
  );

  expect(Object.keys(mudanca ?? {})).toEqual(['nitroCardRates']);
  expect(mudanca?.nitroCardRates).toEqual([{ installments: 1, linkPercent: 8.4, tapPercent: 8.92 }]);
});

/**
 * Preencher a tabela e liga-la são uma gravação só.
 *
 * Com duas, a primeira metade salva e a segunda esquecida deixaria a loja
 * cobrando pela tabela errada — e o servidor recusa a ordem inversa, porque
 * ligar um plano de tabela vazia e 422 de lá.
 */
test('ligar o plano manda a tabela junto', () => {
  const mudanca = changesOf(comNitro({ activeCardPlan: 'nitro' }), settings());

  expect(Object.keys(mudanca ?? {}).toSorted()).toEqual(['activeCardPlan', 'nitroCardRates']);
});

test('trocar só o plano não reenvia tabela nenhuma', () => {
  const salvo = settings({ nitroCardRates: NITRO_RATES });
  const mudanca = changesOf({ ...draftFromSettings(salvo), activeCardPlan: 'nitro' }, salvo);

  expect(mudanca).toEqual({ activeCardPlan: 'nitro' });
});

/** O aviso e sobre o que a cliente vê hoje, então ele lê a tabela em uso. */
test('a parcela sem taxa avisa pela tabela do plano em uso', () => {
  const furado = settings({
    nitroCardRates: NITRO_RATES.filter((rate) => rate.installments !== 7),
  });

  const parado = warningsOf(draftFromSettings(furado));
  const emUso = warningsOf({ ...draftFromSettings(furado), activeCardPlan: 'nitro' });

  expect(parado.some((aviso) => aviso.text.includes('7x'))).toBe(false);
  expect(emUso.some((aviso) => aviso.text.includes('7x'))).toBe(true);
});

/**
 * O plano também esta ligado no aplicativo da operadora, e as duas pontas
 * precisam concordar: cobrar por uma tabela e pagar por outra não dá erro em
 * lugar nenhum, só sai do bolso da dona.
 */
test('o Nitro em uso lembra de conferir o aplicativo da maquininha', () => {
  expect(warningsOf(comNitro({ activeCardPlan: 'nitro' })).some((aviso) =>
    aviso.text.includes('aplicativo'),
  )).toBe(true);

  expect(warningsOf(comNitro()).some((aviso) => aviso.text.includes('aplicativo'))).toBe(false);
});

test('sem a outra tabela não há o que comparar', () => {
  expect(planContrast(draft(), 30_000)).toBeNull();
  expect(planContrast(comNitro({ acceptsCard: false }), 30_000)).toBeNull();
});

/**
 * Acima do limite absorvido a taxa e repassada, então quem sente a diferença
 * de plano e a cliente. R$ 300 em 12x: 15% viram R$ 352,94 e 30% viram
 * R$ 428,57.
 */
test('na parcela repassada, a diferença e do bolso da cliente', () => {
  expect(planContrast(comNitro(), 30_000)).toEqual({
    other: 'nitro',
    count: 12,
    absorbed: false,
    differenceCents: 7563,
  });
});

/**
 * Dentro do limite a taxa sai da loja, e a diferença e no que ela recebe.
 * R$ 300 em 6x: 9% deixam R$ 273,00 e 18% deixam R$ 246,00.
 */
test('na parcela absorvida, a diferença e do que a loja recebe', () => {
  expect(planContrast(comNitro({ maxInstallments: '6' }), 30_000)).toEqual({
    other: 'nitro',
    count: 6,
    absorbed: true,
    differenceCents: 2700,
  });
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
