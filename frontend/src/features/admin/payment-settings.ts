import type { PixKeyType, PublicCard } from '@/features/payments';
import { centsFromInput, centsToInput } from '@/lib/format';
import {
  PAYMENT_LIMITS,
  type AdminPaymentSettings,
  type UpdatePaymentSettingsInput,
} from './admin.types';

/**
 * As regras de pagamento, enquanto estao sendo editadas.
 *
 * ## Por que o rascunho guarda texto
 *
 * Mesma razao do cadastro de produto e da tabela de taxas: no banco os juros
 * sao `1.99` e a parcela minima e `2000`, na tela e o que a dona esta
 * digitando, e no meio do caminho ela passa por `1`, `1,` e `1,9` — nenhum
 * dos quais e um numero. A conversao acontece uma vez, na saida, depois de
 * validar.
 *
 * ## Por que os percentuais passam por `centsFromInput`
 *
 * `1,99%` e um numero com duas casas, exatamente como `R$ 1,99` e um valor
 * com duas casas. Ler com `parseFloat` o texto em reais e o erro que faz
 * `19.99 * 100` virar `1998,9999...`; ler em centesimos inteiros e dividir
 * por cem uma vez so devolve o `1.99` que o servidor espera.
 *
 * ## O que esta tela nao valida
 *
 * Nada alem do que o servidor validaria. A chave PIX e a excecao aparente:
 * ela e conferida aqui **porque** o servidor a confere contra o tipo, e a
 * viagem de ida e volta para descobrir que "CPF" estava marcado com um
 * e-mail dentro custa mais do que a copia da regra. O servidor continua sendo
 * quem decide.
 */

/** As regras como a tela as carrega, com os numeros em texto. */
export interface PaymentDraft {
  acceptsPix: boolean;
  pixKeyType: PixKeyType;
  /** Como a dona a le: com ponto e traco, do jeito que o banco mostra. */
  pixKey: string;
  /** Percentual inteiro. `5` e cinco por cento. */
  pixDiscount: string;
  acceptsCard: boolean;
  maxInstallments: string;
  interestFreeUpTo: string;
  /** `1,99`. Duas casas, porque a maquininha cobra assim. */
  monthlyInterest: string;
  /** `20,00`. Zero e legitimo: e a loja que nao tem parcela minima. */
  minInstallment: string;
}

/** Onde os erros aparecem, por campo. */
export type PaymentErrors = Partial<Record<keyof PaymentDraft, string>>;

/**
 * Um aviso: o servidor aceita, e mesmo assim nao e o que a dona quis.
 *
 * Nao sao erros — bloquear o salvamento por causa deles seria a tela
 * discordando da API. Sao os tres jeitos de configurar esta tela de um modo
 * que *parece* certo aqui e nao aparece do outro lado, e cada um deles so se
 * descobre quando um cliente reclama.
 *
 * O `scope` diz onde o aviso mora: dentro do bloco do PIX, dentro do bloco do
 * cartao, ou acima dos dois quando e a loja inteira que fica sem forma de
 * pagamento.
 */
export interface PaymentWarning {
  scope: 'pix' | 'card' | 'store';
  text: string;
}

/* ---- A chave PIX ----------------------------------------------------------- */

/** Como cada tipo de chave se chama na tela. */
export const PIX_KEY_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Chave aleatória',
};

/** O exemplo que fica dentro do campo, por tipo. */
export const PIX_KEY_PLACEHOLDERS: Record<PixKeyType, string> = {
  cpf: '123.456.789-01',
  cnpj: '12.345.678/0001-90',
  email: 'loja@exemplo.com.br',
  phone: '(88) 99999-9999',
  random: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
};

/**
 * As mesmas frases do backend, palavra por palavra.
 *
 * Iguais de proposito: se um dia a checagem daqui deixar passar algo que a de
 * la recusa, a dona vai ler a mesma mensagem nos dois lugares e nao vai
 * precisar descobrir que sao dois sistemas.
 */
export const PIX_KEY_MESSAGES: Record<PixKeyType, string> = {
  cpf: 'A chave PIX do tipo CPF deve ter 11 digitos.',
  cnpj: 'A chave PIX do tipo CNPJ deve ter 14 digitos.',
  email: 'A chave PIX do tipo e-mail deve ser um endereço válido.',
  phone: 'A chave PIX do tipo telefone deve ter DDD e número, como (88) 99999-9999.',
  random: 'A chave aleatória e o código de 36 caracteres que o banco gera.',
};

/** Chave aleatoria: UUID, do jeito que o banco a entrega. */
const RANDOM_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Suficiente para pegar erro de digitacao; o banco valida o resto. */
const EMAIL_KEY = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/;

/** Pontuacao que vem colada junto e que a chave nao guarda. */
const PUNCTUATION = /[\s.\-()/+]/g;

/** Telefone em formato internacional, como o PIX o registra. */
const PHONE_DIGITS = /^\d{12,15}$/;

const DEFAULT_COUNTRY_CODE = '55';

/** Telefone brasileiro sem o pais: DDD de dois digitos mais 8 ou 9 digitos. */
const BRAZILIAN_WITHOUT_COUNTRY = /^[1-9][0-9]\d{8,9}$/;

/**
 * A chave no formato em que o PIX a registra, ou `null` quando ela nao
 * corresponde ao tipo escolhido.
 *
 * Copia de `normalizePixKey` do backend, inclusive no `+55` que ele acrescenta
 * ao telefone sem pais. A copia tem que ser fiel por uma razao que nao e
 * cosmetica: `changesOf` compara o resultado disto com o que o servidor
 * devolveu. Se as duas normalizacoes divergirem, o campo se acharia sujo a
 * cada abertura da tela e reenviaria o mesmo valor para sempre.
 *
 * Vazio e resposta valida: e a loja que ainda nao configurou a chave.
 */
export function normalizePixKey(value: string, type: PixKeyType): string | null {
  const trimmed = value.trim();

  if (trimmed === '') {
    return '';
  }

  if (type === 'email') {
    const email = trimmed.toLowerCase();

    return EMAIL_KEY.test(email) ? email : null;
  }

  if (type === 'random') {
    const random = trimmed.toLowerCase();

    return RANDOM_KEY.test(random) ? random : null;
  }

  const digits = trimmed.replace(PUNCTUATION, '');

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  if (type === 'cpf') {
    return digits.length === 11 ? digits : null;
  }

  if (type === 'cnpj') {
    return digits.length === 14 ? digits : null;
  }

  const international = BRAZILIAN_WITHOUT_COUNTRY.test(digits)
    ? `${DEFAULT_COUNTRY_CODE}${digits}`
    : digits;

  // O `+` faz parte da chave de telefone, ao contrario do numero do WhatsApp,
  // onde ele quebraria o link `wa.me`.
  return PHONE_DIGITS.test(international) ? `+${international}` : null;
}

/**
 * A chave gravada, escrita do jeito que a dona a reconhece.
 *
 * O banco guarda `12345678901`, e ninguem confere onze digitos corridos
 * olhando. Conferir a chave e a unica coisa que se faz neste campo, e a
 * pontuacao e o que torna isso possivel num relance.
 *
 * Nao e mascara enquanto se digita, de proposito: reposicionar o cursor a
 * cada tecla e o jeito mais rapido de fazer alguem errar a chave. A formatacao
 * acontece ao abrir a tela; `normalizePixKey` desfaz na saida.
 */
export function prettyPixKey(key: string, type: PixKeyType): string {
  if (type === 'cpf' && key.length === 11) {
    return `${key.slice(0, 3)}.${key.slice(3, 6)}.${key.slice(6, 9)}-${key.slice(9)}`;
  }

  if (type === 'cnpj' && key.length === 14) {
    return `${key.slice(0, 2)}.${key.slice(2, 5)}.${key.slice(5, 8)}/${key.slice(8, 12)}-${key.slice(12)}`;
  }

  if (type === 'phone' && key.startsWith('+55') && key.length >= 13) {
    const ddd = key.slice(3, 5);
    const rest = key.slice(5);
    const half = rest.length - 4;

    return `+55 (${ddd}) ${rest.slice(0, half)}-${rest.slice(half)}`;
  }

  return key;
}

/* ---- Abrir e fechar o rascunho ---------------------------------------------- */

/** As regras salvas, abertas para edicao. */
export function draftFromSettings(settings: AdminPaymentSettings): PaymentDraft {
  return {
    acceptsPix: settings.acceptsPix,
    pixKeyType: settings.pixKeyType,
    pixKey: prettyPixKey(settings.pixKey, settings.pixKeyType),
    pixDiscount: String(settings.pixDiscountPercent),
    acceptsCard: settings.acceptsCard,
    maxInstallments: String(settings.maxInstallments),
    interestFreeUpTo: String(settings.interestFreeUpTo),
    monthlyInterest: percentToInput(settings.monthlyInterestPercent),
    minInstallment: centsToInput(settings.minInstallmentCents),
  };
}

/**
 * O que impede as regras de serem salvas.
 *
 * Os campos do cartao continuam sendo validados com o cartao desligado. A
 * alternativa — deixar passar qualquer coisa enquanto a opcao esta fora do ar
 * — grava um `maxInstallments` invalido que so vai reclamar meses depois,
 * quando a dona religar o cartao numa promocao e o `PATCH` voltar 400 sem
 * ela ter tocado naquele campo.
 */
export function validatePayment(draft: PaymentDraft): PaymentErrors {
  const errors: PaymentErrors = {};

  if (normalizePixKey(draft.pixKey, draft.pixKeyType) === null) {
    errors.pixKey = PIX_KEY_MESSAGES[draft.pixKeyType];
  } else if (draft.pixKey.trim().length > PAYMENT_LIMITS.pixKeyLength) {
    errors.pixKey = 'Essa chave passa do tamanho que o sistema guarda.';
  }

  const discount = integerOf(draft.pixDiscount);

  if (discount === null || discount < 0) {
    errors.pixDiscount = 'Escreva o desconto em porcentagem inteira, ou 0 para não dar desconto.';
  } else if (discount > PAYMENT_LIMITS.pixDiscountPercent) {
    errors.pixDiscount = `O desconto máximo e de ${String(PAYMENT_LIMITS.pixDiscountPercent)}%.`;
  }

  const max = integerOf(draft.maxInstallments);

  if (max === null || max < 1) {
    errors.maxInstallments = 'Escreva em quantas vezes a loja parcela. Uma, no mínimo.';
  } else if (max > PAYMENT_LIMITS.installments) {
    errors.maxInstallments = `Nenhum cartão parcela em mais de ${String(PAYMENT_LIMITS.installments)} vezes.`;
  }

  const free = integerOf(draft.interestFreeUpTo);

  if (free === null || free < 1) {
    errors.interestFreeUpTo = 'Escreva até quantas parcelas não tem juros. Uma, no mínimo.';
  } else if (free > PAYMENT_LIMITS.installments) {
    errors.interestFreeUpTo = `O limite do sistema e de ${String(PAYMENT_LIMITS.installments)} parcelas.`;
  } else if (max !== null && free > max) {
    // A mesma recusa do schema, antecipada: parcela sem juros alem do maximo
    // de parcelas nao significa nada.
    errors.interestFreeUpTo = 'Sem juros até mais parcelas do que a loja aceita parcelar.';
  }

  const interest = percentFromInput(draft.monthlyInterest);

  if (interest === null || interest < 0) {
    errors.monthlyInterest = 'Escreva os juros ao mês, ou 0 se a loja não cobra juros.';
  } else if (interest > PAYMENT_LIMITS.monthlyInterestPercent) {
    errors.monthlyInterest = `Os juros máximos são de ${String(PAYMENT_LIMITS.monthlyInterestPercent)}% ao mês.`;
  }

  const minimum = centsFromInput(draft.minInstallment);

  if (minimum === null || minimum < 0) {
    errors.minInstallment = 'Escreva a parcela mínima, ou 0 se não houver mínimo.';
  } else if (minimum > PAYMENT_LIMITS.minInstallmentCents) {
    errors.minInstallment = 'Esse valor passa do limite do sistema.';
  }

  return errors;
}

export function hasPaymentErrors(errors: PaymentErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * O que o servidor aceita e a dona provavelmente nao quis.
 *
 * Roda sobre o rascunho, e nao sobre o que esta salvo: o objetivo e a dona
 * ler o aviso **antes** de salvar, enquanto ainda esta com a mao no campo que
 * o causou.
 */
export function warningsOf(draft: PaymentDraft): PaymentWarning[] {
  const warnings: PaymentWarning[] = [];

  if (!draft.acceptsPix && !draft.acceptsCard) {
    warnings.push({
      scope: 'store',
      text: 'Nenhuma forma de pagamento esta ligada. O checkout continua fechando pedido, e a cliente termina sem saber como pagar.',
    });
  }

  // O caso que mais acontece: a opcao fica ligada, a chave nunca e
  // preenchida, e a rota publica devolve `hasKey: false` — o PIX simplesmente
  // nao aparece, sem erro nenhum em lugar nenhum.
  if (draft.acceptsPix && draft.pixKey.trim() === '') {
    warnings.push({
      scope: 'pix',
      text: 'O PIX esta ligado, mas sem chave cadastrada ele não aparece para a cliente.',
    });
  }

  const max = integerOf(draft.maxInstallments);
  const free = integerOf(draft.interestFreeUpTo);
  const interest = percentFromInput(draft.monthlyInterest);

  if (
    draft.acceptsCard &&
    interest !== null &&
    interest > 0 &&
    max !== null &&
    free !== null &&
    free >= max
  ) {
    warnings.push({
      scope: 'card',
      text: 'Todas as parcelas estão dentro do limite sem juros, então estes juros nunca são cobrados.',
    });
  }

  return warnings;
}

/**
 * So o que mudou em relacao ao que veio do servidor.
 *
 * Devolve `null` quando nada mudou, e quem chama usa isso para desligar o
 * botao de salvar. Mandar o documento inteiro a cada gravacao sobrescreveria
 * com valores antigos o que outra aba acabou de mudar — e este e um documento
 * unico, entao "outra aba" inclui a propria dona no celular.
 *
 * A chave e o tipo viajam juntos quando qualquer um dos dois muda: o servidor
 * confere o par, e um `PATCH` so com o tipo o obrigaria a adivinhar contra
 * qual chave conferir.
 */
export function changesOf(
  draft: PaymentDraft,
  settings: AdminPaymentSettings,
): UpdatePaymentSettingsInput | null {
  const changes: UpdatePaymentSettingsInput = {};

  if (draft.acceptsPix !== settings.acceptsPix) {
    changes.acceptsPix = draft.acceptsPix;
  }

  const key = normalizePixKey(draft.pixKey, draft.pixKeyType) ?? settings.pixKey;

  if (key !== settings.pixKey || draft.pixKeyType !== settings.pixKeyType) {
    changes.pixKey = key;
    changes.pixKeyType = draft.pixKeyType;
  }

  const discount = integerOf(draft.pixDiscount) ?? settings.pixDiscountPercent;

  if (discount !== settings.pixDiscountPercent) {
    changes.pixDiscountPercent = discount;
  }

  if (draft.acceptsCard !== settings.acceptsCard) {
    changes.acceptsCard = draft.acceptsCard;
  }

  const max = integerOf(draft.maxInstallments) ?? settings.maxInstallments;

  if (max !== settings.maxInstallments) {
    changes.maxInstallments = max;
  }

  const free = integerOf(draft.interestFreeUpTo) ?? settings.interestFreeUpTo;

  if (free !== settings.interestFreeUpTo) {
    changes.interestFreeUpTo = free;
  }

  const interest = percentFromInput(draft.monthlyInterest) ?? settings.monthlyInterestPercent;

  if (interest !== settings.monthlyInterestPercent) {
    changes.monthlyInterestPercent = interest;
  }

  const minimum = centsFromInput(draft.minInstallment) ?? settings.minInstallmentCents;

  if (minimum !== settings.minInstallmentCents) {
    changes.minInstallmentCents = minimum;
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/**
 * Ha algo pendente na tela.
 *
 * Nao e o mesmo que `changesOf(...) !== null`, e a diferenca importa: uma
 * chave PIX escrita errada para o tipo escolhido nao vira mudanca nenhuma —
 * nao ha o que mandar —, e sem isto aqui a dona digitaria a chave errada e a
 * tela nao reagiria de jeito nenhum. Nem barra, nem erro, nem nada.
 *
 * Com o campo invalido contando como pendencia, a barra aparece, o botao
 * revela o erro e o caminho se fecha.
 */
export function isDirty(draft: PaymentDraft, settings: AdminPaymentSettings): boolean {
  return changesOf(draft, settings) !== null || hasPaymentErrors(validatePayment(draft));
}

/* ---- A previa ---------------------------------------------------------------- */

/**
 * As regras do rascunho, no formato que o calculo de parcelas consome.
 *
 * Do rascunho e nao do que esta salvo: e isso que faz a previa ser ao vivo. A
 * dona troca `3` por `6` no limite sem juros e ve a lista inteira mudar antes
 * de salvar, que e o unico momento em que a decisao ainda pode ser outra.
 *
 * Devolve `null` com o cartao desligado ou com um numero que ainda nao e
 * numero — a previa some em vez de mostrar uma conta feita sobre zero.
 *
 * O limite sem juros e aparado pelo maximo de parcelas. Um rascunho com "sem
 * juros ate 12" e "parcela ate 6" e recusado na validacao, mas ele existe no
 * meio da digitacao, e sem o aparo a previa anunciaria juros zero em tudo por
 * causa de um estado que dura dois caracteres.
 */
export function previewCard(draft: PaymentDraft): PublicCard | null {
  if (!draft.acceptsCard) {
    return null;
  }

  const maxInstallments = integerOf(draft.maxInstallments);
  const interestFreeUpTo = integerOf(draft.interestFreeUpTo);
  const monthlyInterestPercent = percentFromInput(draft.monthlyInterest);
  const minInstallmentCents = centsFromInput(draft.minInstallment);

  if (
    maxInstallments === null ||
    maxInstallments < 1 ||
    interestFreeUpTo === null ||
    monthlyInterestPercent === null ||
    monthlyInterestPercent < 0 ||
    minInstallmentCents === null ||
    minInstallmentCents < 0
  ) {
    return null;
  }

  return {
    maxInstallments,
    interestFreeUpTo: Math.min(interestFreeUpTo, maxInstallments),
    monthlyInterestPercent,
    minInstallmentCents,
  };
}

/** O que a previa do PIX mostra, ou `null` com o PIX desligado. */
export interface PixPreview {
  discountCents: number;
  totalCents: number;
}

/**
 * O total no PIX de um pedido, e quanto o desconto tirou.
 *
 * Copia de `pixQuoteOf` do backend, sem a parte da entrega: aqui o valor
 * digitado e o subtotal de produtos, e o desconto do PIX nunca incide sobre o
 * frete — ele nao e margem da loja, e ja foi pago a quem leva.
 *
 * `Math.round` na virada do centavo, a favor de quem paga, como no servidor.
 */
export function pixPreview(draft: PaymentDraft, subtotalCents: number): PixPreview | null {
  if (!draft.acceptsPix) {
    return null;
  }

  const percent = integerOf(draft.pixDiscount);

  if (percent === null || percent < 0) {
    return null;
  }

  const discountCents = Math.round((subtotalCents * percent) / 100);

  return { discountCents, totalCents: subtotalCents - discountCents };
}

/* ---- Numeros ------------------------------------------------------------------ */

/**
 * Um inteiro escrito a mao, ou `null`.
 *
 * `Number.parseInt` nao serve: ele le `12abc` como `12` e `1,5` como `1`, e
 * os dois entrariam no `PATCH` como se a dona tivesse digitado outra coisa.
 */
function integerOf(value: string): number | null {
  const trimmed = value.trim();

  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Um percentual com ate duas casas, ou `null`.
 *
 * Passa por `centsFromInput` porque `1,99%` tem a mesma forma que `R$ 1,99`:
 * ler em centesimos inteiros e dividir por cem uma vez so e o que devolve
 * exatamente `1.99`, e nao o `1.9900000000000002` que um `parseFloat` sobre
 * texto com virgula acaba produzindo depois de qualquer conta.
 */
export function percentFromInput(value: string): number | null {
  const hundredths = centsFromInput(value);

  return hundredths === null ? null : hundredths / 100;
}

/** O caminho de volta: `1.99` vira `1,99`. */
export function percentToInput(value: number): string {
  return centsToInput(Math.round(value * 100));
}
