import {
  CARD_PLANS,
  CARD_PLAN_LABELS,
  grossUp,
  netOf,
  type CardPlan,
  type InstallmentRules,
  type PixKeyType,
} from '@/features/payments';
import { centsFromInput, centsToInput } from '@/lib/format';
import {
  PAYMENT_LIMITS,
  type AdminCardRate,
  type AdminPaymentSettings,
  type UpdatePaymentSettingsInput,
} from './admin.types';

/**
 * As regras de pagamento, enquanto estão sendo editadas.
 *
 * ## Por que o rascunho guarda texto
 *
 * Mesma razão do cadastro de produto e da tabela de taxas: no banco os juros
 * são `1.99` e a parcela mínima e `2000`, na tela e o que a dona esta
 * digitando, e no meio do caminho ela passa por `1`, `1,` e `1,9` — nenhum
 * dos quais e um número. A conversão acontece uma vez, na saída, depois de
 * validar.
 *
 * ## Por que os percentuais passam por `centsFromInput`
 *
 * `1,99%` e um número com duas casas, exatamente como `R$ 1,99` e um valor
 * com duas casas. Ler com `parseFloat` o texto em reais e o erro que faz
 * `19.99 * 100` virar `1998,9999...`; ler em centesimos inteiros e dividir
 * por cem uma vez só devolve o `1.99` que o servidor espera.
 *
 * ## O que esta tela não valida
 *
 * Nada além do que o servidor validaria. A chave PIX e a exceção aparente:
 * ela e conferida aqui **porque** o servidor a confere contra o tipo, e a
 * viagem de ida e volta para descobrir que "CPF" estava marcado com um
 * e-mail dentro custa mais do que a copia da regra. O servidor continua sendo
 * quem decide.
 */

/**
 * Uma linha da tabela de taxas, em edição.
 *
 * As duas células vazias significam "esta parcela não tem taxa cadastrada", e
 * isso não e erro: a parcela simplesmente deixa de ser oferecida acima do
 * limite que a loja absorve. Uma célula só preenchida e erro — seria oferecer
 * a parcela numa modalidade e esconde-la na outra, e a dona não veria isso
 * acontecer.
 */
export interface RateDraft {
  installments: number;
  /** `16,66`. Texto, como todo número deste rascunho. */
  link: string;
  tap: string;
}

/** As regras como a tela as carrega, com os números em texto. */
export interface PaymentDraft {
  acceptsPix: boolean;
  pixKeyType: PixKeyType;
  /** Como a dona a lê: com ponto e traço, do jeito que o banco mostra. */
  pixKey: string;
  /** Percentual inteiro. `5` e cinco por cento. */
  pixDiscount: string;
  acceptsCard: boolean;
  maxInstallments: string;
  interestFreeUpTo: string;
  /** A tabela da operadora, uma linha por parcela, da primeira a última. */
  rates: RateDraft[];
  /** A mesma tabela, do plano Nitro. Toda em branco enquanto a loja não o usa. */
  nitroRates: RateDraft[];
  /**
   * Qual das duas tabelas vale no checkout.
   *
   * Vive no rascunho, e não num botão que grava sozinho, porque ligar o Nitro
   * sem a tabela preenchida não pode acontecer — e as duas coisas se decidem
   * na mesma tela, no mesmo gesto. Salvas juntas, a troca e atômica: ou o
   * plano e a tabela entram, ou nenhum dos dois entra.
   */
  activeCardPlan: CardPlan;
  /** `20,00`. Zero e legitimo: e a loja que não tem parcela mínima. */
  minInstallment: string;
}

/**
 * Onde os erros aparecem.
 *
 * A tabela foge do formato dos outros campos de propósito. Um erro só para
 * ela inteira — "confira as taxas" — mandaria a dona procurar a célula errada
 * no olho, entre vinte e quatro delas; os erros vem por quantidade de
 * parcelas, e a linha que os carrega e a que fica marcada.
 *
 * As duas tabelas têm cada uma o seu mapa. A do plano que não esta em uso
 * também e conferida: ela vai ao servidor no mesmo `PATCH`, e um erro dela
 * recusaria a gravação inteira. Sem um mapa próprio, a recusa apareceria
 * marcando a linha errada da tabela errada.
 */
export type PaymentErrors = Partial<
  Record<Exclude<keyof PaymentDraft, 'rates' | 'nitroRates'>, string>
> & {
  rates?: Record<number, string>;
  nitroRates?: Record<number, string>;
};

/**
 * Um aviso: o servidor aceita, e mesmo assim não e o que a dona quis.
 *
 * Não são erros — bloquear o salvamento por causa deles seria a tela
 * discordando da API. São os três jeitos de configurar esta tela de um modo
 * que *parece* certo aqui e não aparece do outro lado, e cada um deles só se
 * descobre quando um cliente reclama.
 *
 * O `scope` diz onde o aviso mora: dentro do bloco do PIX, dentro do bloco do
 * cartão, ou acima dos dois quando e a loja inteira que fica sem forma de
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
 * Iguais de propósito: se um dia a checagem daqui deixar passar algo que a de
 * lá recusa, a dona vai ler a mesma mensagem nos dois lugares e não vai
 * precisar descobrir que são dois sistemas.
 */
export const PIX_KEY_MESSAGES: Record<PixKeyType, string> = {
  cpf: 'A chave PIX do tipo CPF deve ter 11 digitos.',
  cnpj: 'A chave PIX do tipo CNPJ deve ter 14 digitos.',
  email: 'A chave PIX do tipo e-mail deve ser um endereço válido.',
  phone: 'A chave PIX do tipo telefone deve ter DDD e número, como (88) 99999-9999.',
  random: 'A chave aleatória e o código de 36 caracteres que o banco gera.',
};

/** Chave aleatória: UUID, do jeito que o banco a entrega. */
const RANDOM_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Suficiente para pegar erro de digitação; o banco valida o resto. */
const EMAIL_KEY = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/;

/** Pontuação que vem colada junto e que a chave não guarda. */
const PUNCTUATION = /[\s.\-()/+]/g;

/** Telefone em formato internacional, como o PIX o registra. */
const PHONE_DIGITS = /^\d{12,15}$/;

const DEFAULT_COUNTRY_CODE = '55';

/** Telefone brasileiro sem o pais: DDD de dois digitos mais 8 ou 9 digitos. */
const BRAZILIAN_WITHOUT_COUNTRY = /^[1-9][0-9]\d{8,9}$/;

/**
 * A chave no formato em que o PIX a registra, ou `null` quando ela não
 * corresponde ao tipo escolhido.
 *
 * Copia de `normalizePixKey` do backend, inclusive no `+55` que ele acrescenta
 * ao telefone sem pais. A copia tem que ser fiel por uma razão que não e
 * cosmética: `changesOf` compara o resultado disto com o que o servidor
 * devolveu. Se as duas normalizações divergirem, o campo se acharia sujo a
 * cada abertura da tela e reenviaria o mesmo valor para sempre.
 *
 * Vazio e resposta valida: e a loja que ainda não configurou a chave.
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

  // O `+` faz parte da chave de telefone, ao contrário do número do WhatsApp,
  // onde ele quebraria o link `wa.me`.
  return PHONE_DIGITS.test(international) ? `+${international}` : null;
}

/**
 * A chave gravada, escrita do jeito que a dona a reconhece.
 *
 * O banco guarda `12345678901`, e ninguém confere onze digitos corridos
 * olhando. Conferir a chave e a única coisa que se faz neste campo, e a
 * pontuação e o que torna isso possível num relance.
 *
 * Não e máscara enquanto se digita, de propósito: reposicionar o cursor a
 * cada tecla e o jeito mais rápido de fazer alguém errar a chave. A formatação
 * acontece ao abrir a tela; `normalizePixKey` desfaz na saída.
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

/** As regras salvas, abertas para edição. */
export function draftFromSettings(settings: AdminPaymentSettings): PaymentDraft {
  return {
    acceptsPix: settings.acceptsPix,
    pixKeyType: settings.pixKeyType,
    pixKey: prettyPixKey(settings.pixKey, settings.pixKeyType),
    pixDiscount: String(settings.pixDiscountPercent),
    acceptsCard: settings.acceptsCard,
    maxInstallments: String(settings.maxInstallments),
    interestFreeUpTo: String(settings.interestFreeUpTo),
    rates: ratesDraftOf(settings.cardRates, settings.maxInstallments),
    nitroRates: ratesDraftOf(settings.nitroCardRates, settings.maxInstallments),
    activeCardPlan: settings.activeCardPlan,
    minInstallment: centsToInput(settings.minInstallmentCents),
  };
}

/**
 * A tabela gravada, aberta para edição, com uma linha por parcela oferecida.
 *
 * Linha que a loja oferece e a operadora ainda não teve taxa cadastrada nasce
 * vazia, visível e esperando: a alternativa seria a dona precisar descobrir
 * que falta uma linha olhando para uma lista que não a menciona.
 */
export function ratesDraftOf(
  rates: readonly AdminCardRate[],
  maxInstallments: number,
): RateDraft[] {
  const saved = new Map(rates.map((rate) => [rate.installments, rate]));
  const last = Math.max(maxInstallments, ...rates.map((rate) => rate.installments), 1);
  const rows: RateDraft[] = [];

  for (let installments = 1; installments <= last; installments += 1) {
    const rate = saved.get(installments);

    rows.push({
      installments,
      link: rate === undefined ? '' : percentToInput(rate.linkPercent),
      tap: rate === undefined ? '' : percentToInput(rate.tapPercent),
    });
  }

  return rows;
}

/**
 * A tabela com linhas suficientes para o máximo de parcelas pedido.
 *
 * Acrescenta o que falta e **não tira** o que sobra. Baixar o limite de 12
 * para 6 e uma decisão que se desfaz num segundo; apagar as seis taxas de
 * baixo junto faria a dona redigitar a tabela inteira ao voltar atrás, e ela
 * não teria como saber que foi isso que aconteceu.
 */
export function syncedRates(rates: readonly RateDraft[], maxInstallments: number): RateDraft[] {
  if (rates.length >= maxInstallments) {
    return [...rates];
  }

  const rows = [...rates];

  for (let installments = rows.length + 1; installments <= maxInstallments; installments += 1) {
    rows.push({ installments, link: '', tap: '' });
  }

  return rows;
}

/**
 * O que impede as regras de serem salvas.
 *
 * Os campos do cartão continuam sendo validados com o cartão desligado. A
 * alternativa — deixar passar qualquer coisa enquanto a opção esta fora do ar
 * — grava um `maxInstallments` inválido que só vai reclamar meses depois,
 * quando a dona religar o cartão numa promoção e o `PATCH` voltar 400 sem
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
    // A mesma recusa do schema, antecipada: parcela sem juros além do máximo
    // de parcelas não significa nada.
    errors.interestFreeUpTo = 'Sem juros até mais parcelas do que a loja aceita parcelar.';
  }

  const rates = rateErrorsOf(draft.rates);

  if (Object.keys(rates).length > 0) {
    errors.rates = rates;
  }

  const nitroRates = rateErrorsOf(draft.nitroRates);

  if (Object.keys(nitroRates).length > 0) {
    errors.nitroRates = nitroRates;
  }

  // A mesma recusa do schema, antecipada. Plano ativo sem tabela não devolve
  // erro nenhum no checkout: a parcela sem taxa simplesmente deixa de ser
  // oferecida, e a loja passaria a semana vendendo só a vista sem nada na
  // tela dizendo por que.
  if (!hasAnyRate(ratesOfPlan(draft, draft.activeCardPlan))) {
    errors.activeCardPlan = `A tabela do plano ${CARD_PLAN_LABELS[draft.activeCardPlan]} esta vazia. Preencha-a antes de deixar este plano em uso.`;
  }

  const minimum = centsFromInput(draft.minInstallment);

  if (minimum === null || minimum < 0) {
    errors.minInstallment = 'Escreva a parcela mínima, ou 0 se não houver mínimo.';
  } else if (minimum > PAYMENT_LIMITS.minInstallmentCents) {
    errors.minInstallment = 'Esse valor passa do limite do sistema.';
  }

  return errors;
}

/**
 * O que impede a tabela de taxas de ser salva, linha por linha.
 *
 * Linha inteira vazia passa: e a parcela sem taxa cadastrada, que o servidor
 * entende como "não oferecer". Meia linha não passa.
 */
function rateErrorsOf(rates: readonly RateDraft[]): Record<number, string> {
  const errors: Record<number, string> = {};

  for (const row of rates) {
    const link = row.link.trim();
    const tap = row.tap.trim();

    if (link === '' && tap === '') {
      continue;
    }

    if (link === '' || tap === '') {
      errors[row.installments] = 'Preencha as duas taxas, ou deixe as duas em branco.';
      continue;
    }

    const linkPercent = percentFromInput(link);
    const tapPercent = percentFromInput(tap);

    if (
      linkPercent === null ||
      tapPercent === null ||
      linkPercent < 0 ||
      tapPercent < 0
    ) {
      errors[row.installments] = 'Escreva a taxa em porcentagem, como 16,66.';
      continue;
    }

    if (
      linkPercent > PAYMENT_LIMITS.cardFeePercent ||
      tapPercent > PAYMENT_LIMITS.cardFeePercent
    ) {
      errors[row.installments] = `A taxa máxima e de ${String(PAYMENT_LIMITS.cardFeePercent)}%.`;
    }
  }

  return errors;
}

export function hasPaymentErrors(errors: PaymentErrors): boolean {
  return Object.keys(errors).length > 0;
}

/* ---- Os dois planos ---------------------------------------------------------- */

/**
 * A tabela de um plano, no rascunho.
 *
 * Um `if` num lugar só, e por isso uma função: o plano escolhe a tabela na
 * validação, nos avisos, na prévia e no que viaja no `PATCH`, e os quatro
 * precisam escolher a mesma. Espelha `activeCardRates` do backend.
 */
export function ratesOfPlan(draft: PaymentDraft, plan: CardPlan): readonly RateDraft[] {
  return plan === CARD_PLANS.NITRO ? draft.nitroRates : draft.rates;
}

/** O outro plano: o que a tela compara contra, e o que a dona pode ligar. */
export function otherPlan(plan: CardPlan): CardPlan {
  return plan === CARD_PLANS.NITRO ? CARD_PLANS.STANDARD : CARD_PLANS.NITRO;
}

/**
 * A tabela tem ao menos uma linha para gravar.
 *
 * Meia linha conta: ela e um erro próprio, cadastrado em `rateErrorsOf`, e
 * somar "e também esta vazia" por cima mandaria a dona procurar duas coisas
 * para consertar uma.
 */
export function hasAnyRate(rates: readonly RateDraft[]): boolean {
  return rates.some((row) => row.link.trim() !== '' || row.tap.trim() !== '');
}

/**
 * O que o servidor aceita e a dona provavelmente não quis.
 *
 * Roda sobre o rascunho, e não sobre o que esta salvo: o objetivo e a dona
 * ler o aviso **antes** de salvar, enquanto ainda esta com a mão no campo que
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

  // O caso que mais acontece: a opção fica ligada, a chave nunca e
  // preenchida, e a rota publica devolve `hasKey: false` — o PIX simplesmente
  // não aparece, sem erro nenhum em lugar nenhum.
  if (draft.acceptsPix && draft.pixKey.trim() === '') {
    warnings.push({
      scope: 'pix',
      text: 'O PIX esta ligado, mas sem chave cadastrada ele não aparece para a cliente.',
    });
  }

  const max = integerOf(draft.maxInstallments);
  const free = integerOf(draft.interestFreeUpTo);

  if (draft.acceptsCard && max !== null && free !== null && free >= max) {
    warnings.push({
      scope: 'card',
      text: 'Todas as parcelas estão dentro do limite sem juros, então a loja absorve a taxa de todas elas.',
    });
  }

  // Daqui para baixo os avisos são sobre o que a cliente vê hoje, então eles
  // leem a tabela do plano em uso. A do outro plano pode estar pela metade
  // sem consequência nenhuma — ela não cota nada enquanto não for ligada.
  const active = ratesOfPlan(draft, draft.activeCardPlan);

  // A falta que não aparece: a parcela sem taxa some da lista do checkout, e
  // o único sinal disso e a lista mais curta na prévia ao lado.
  if (draft.acceptsCard && max !== null && free !== null) {
    const faltando = active
      .filter((row) => row.installments > free && row.installments <= max)
      .filter((row) => row.link.trim() === '' || row.tap.trim() === '')
      .map((row) => row.installments);

    if (faltando.length > 0) {
      warnings.push({
        scope: 'card',
        text: `Sem taxa cadastrada, ${listOf(faltando)} não aparece${faltando.length > 1 ? 'm' : ''} para a cliente.`,
      });
    }
  }

  // As duas colunas iguais são o estado em que a loja nasce, e não uma
  // decisão: a tabela padrão repete a do link na maquininha para nunca
  // cobrar a menos. Enquanto estiver assim, quem paga na entrega paga a
  // taxa do link.
  if (draft.acceptsCard && active.length > 0 && sameColumns(active)) {
    warnings.push({
      scope: 'card',
      text: 'As taxas do link e da maquininha estão iguais. Se as suas forem diferentes, quem paga na entrega esta pagando a mais.',
    });
  }

  // O plano e a única coisa desta tela que também esta ligada em outro
  // lugar — no aplicativo da operadora. Enquanto o Nitro estiver em uso, o
  // aviso lembra que as duas pontas precisam concordar: vender pela tabela
  // errada não dá erro em lugar nenhum, só sai do bolso da dona.
  if (draft.acceptsCard && draft.activeCardPlan === CARD_PLANS.NITRO) {
    warnings.push({
      scope: 'card',
      text: 'O plano Nitro esta em uso aqui. Confira se ele também esta ligado no aplicativo da maquininha — se não estiver, a loja cobra por uma tabela e paga por outra.',
    });
  }

  return warnings;
}

/** `4x`, `4x e 7x`, `4x, 7x e 10x`. */
function listOf(installments: readonly number[]): string {
  const labels = installments.map((count) => `${String(count)}x`);

  const last = labels.at(-1) ?? '';

  if (labels.length === 1) {
    return last;
  }

  return `${labels.slice(0, -1).join(', ')} e ${last}`;
}

/** Nenhuma linha preenchida distingue as duas modalidades. */
function sameColumns(rates: readonly RateDraft[]): boolean {
  const filled = rates.filter((row) => row.link.trim() !== '' && row.tap.trim() !== '');

  return filled.length > 0 && filled.every((row) => row.link.trim() === row.tap.trim());
}

/**
 * Só o que mudou em relação ao que veio do servidor.
 *
 * Devolve `null` quando nada mudou, e quem chama usa isso para desligar o
 * botão de salvar. Mandar o documento inteiro a cada gravação sobrescreveria
 * com valores antigos o que outra aba acabou de mudar — e este e um documento
 * único, então "outra aba" inclui a própria dona no celular.
 *
 * A chave e o tipo viajam juntos quando qualquer um dos dois muda: o servidor
 * confere o par, e um `PATCH` só com o tipo o obrigaria a adivinhar contra
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

  const rates = ratesOf(draft.rates);

  if (rates !== null && !sameRates(rates, settings.cardRates)) {
    changes.cardRates = rates;
  }

  const nitroRates = ratesOf(draft.nitroRates);

  if (nitroRates !== null && !sameRates(nitroRates, settings.nitroCardRates)) {
    changes.nitroCardRates = nitroRates;
  }

  // O plano viaja sozinho quando só ele mudou: a tabela do outro plano já
  // esta gravada do lado de lá, e reenvia-la por garantia sobrescreveria com
  // o que esta tela abriu uma correção feita em outra aba.
  if (draft.activeCardPlan !== settings.activeCardPlan) {
    changes.activeCardPlan = draft.activeCardPlan;
  }

  const minimum = centsFromInput(draft.minInstallment) ?? settings.minInstallmentCents;

  if (minimum !== settings.minInstallmentCents) {
    changes.minInstallmentCents = minimum;
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/**
 * Há algo pendente na tela.
 *
 * Não e o mesmo que `changesOf(...) !== null`, e a diferença importa: uma
 * chave PIX escrita errada para o tipo escolhido não vira mudanca nenhuma —
 * não há o que mandar —, e sem isto aqui a dona digitaria a chave errada e a
 * tela não reagiria de jeito nenhum. Nem barra, nem erro, nem nada.
 *
 * Com o campo inválido contando como pendência, a barra aparece, o botão
 * revela o erro e o caminho se fecha.
 */
export function isDirty(draft: PaymentDraft, settings: AdminPaymentSettings): boolean {
  return changesOf(draft, settings) !== null || hasPaymentErrors(validatePayment(draft));
}

/**
 * A tabela do rascunho pronta para o servidor, ou `null` se ela ainda não
 * esta inteira.
 *
 * Linha vazia sai da lista: no documento, taxa que não existe e linha que não
 * existe, e e isso que faz a parcela não ser oferecida.
 */
function ratesOf(rates: readonly RateDraft[]): AdminCardRate[] | null {
  const rows: AdminCardRate[] = [];

  for (const row of rates) {
    if (row.link.trim() === '' && row.tap.trim() === '') {
      continue;
    }

    const linkPercent = percentFromInput(row.link);
    const tapPercent = percentFromInput(row.tap);

    if (linkPercent === null || tapPercent === null) {
      return null;
    }

    rows.push({ installments: row.installments, linkPercent, tapPercent });
  }

  return rows;
}

/** Mesma tabela, linha por linha e na mesma ordem. */
function sameRates(draft: readonly AdminCardRate[], saved: readonly AdminCardRate[]): boolean {
  return (
    draft.length === saved.length &&
    draft.every((row, index) => {
      const other = saved[index];

      return (
        other !== undefined &&
        row.installments === other.installments &&
        row.linkPercent === other.linkPercent &&
        row.tapPercent === other.tapPercent
      );
    })
  );
}

/* ---- A prévia ---------------------------------------------------------------- */

/** As duas colunas da tabela, cada uma pronta para o cálculo. */
export interface CardPreviewRules {
  link: InstallmentRules;
  tap: InstallmentRules;
}

/**
 * As regras do rascunho, no formato que o cálculo de parcelas consome.
 *
 * Do rascunho e não do que esta salvo: e isso que faz a prévia ser ao vivo. A
 * dona troca `3` por `6` no limite sem juros e vê a lista inteira mudar antes
 * de salvar, que e o único momento em que a decisão ainda pode ser outra.
 *
 * Devolve as duas colunas: a prévia mostra o link e a maquininha lado a
 * lado, que e a comparação que a dona precisa fazer para decidir.
 *
 * Devolve `null` com o cartão desligado ou com um número que ainda não e
 * número — a prévia some em vez de mostrar uma conta feita sobre zero.
 *
 * O limite sem juros e aparado pelo máximo de parcelas. Um rascunho com "sem
 * juros até 12" e "parcela até 6" e recusado na validação, mas ele existe no
 * meio da digitação, e sem o aparo a prévia anunciaria juros zero em tudo por
 * causa de um estado que dura dois caracteres.
 */
export function previewRules(draft: PaymentDraft): CardPreviewRules | null {
  if (!draft.acceptsCard) {
    return null;
  }

  const maxInstallments = integerOf(draft.maxInstallments);
  const interestFreeUpTo = integerOf(draft.interestFreeUpTo);
  const minInstallmentCents = centsFromInput(draft.minInstallment);

  if (
    maxInstallments === null ||
    maxInstallments < 1 ||
    interestFreeUpTo === null ||
    minInstallmentCents === null ||
    minInstallmentCents < 0
  ) {
    return null;
  }

  const shared = {
    maxInstallments,
    interestFreeUpTo: Math.min(interestFreeUpTo, maxInstallments),
    minInstallmentCents,
  };

  const active = ratesOfPlan(draft, draft.activeCardPlan);

  return {
    link: { ...shared, feePercents: feePercentsOf(active, 'link') },
    tap: { ...shared, feePercents: feePercentsOf(active, 'tap') },
  };
}

/**
 * Quanto o outro plano mudaria nesta venda.
 *
 * ## Por que esta linha existe
 *
 * A tela mostra duas tabelas de percentuais, e percentual nenhum responde a
 * pergunta que a dona faz: *vale a pena receber na hora?* O Nitro adianta o
 * dinheiro da venda parcelada e cobra mais por isso — quanto mais, em reais,
 * nesta venda, e o que decide. Sem este número a escolha vira comparar
 * 9,67% com 13,50% de cabeça, no meio de vinte e quatro linhas.
 *
 * ## Em qual parcela
 *
 * Na maior que as duas tabelas têm em comum, dentro do que a loja parcela. E
 * onde a diferença entre os planos e maior, e e a parcela que mais aparece
 * nos pedidos que motivam a pergunta.
 *
 * ## Quem sente a diferença muda com a parcela
 *
 * Dentro do limite sem juros a taxa sai da loja, então o plano mexe no que
 * ela **recebe**. Acima dele a taxa e repassada, e o plano mexe no que a
 * cliente **paga** — e preço mais alto não e custo, e venda que não acontece.
 * São duas frases diferentes, e `absorbed` diz qual delas cabe.
 *
 * Devolve `null` quando não há o que comparar: cartão desligado, a outra
 * tabela vazia naquela parcela, ou as duas com a mesma taxa.
 */
export interface PlanContrast {
  /** O plano que **não** esta em uso. */
  other: CardPlan;
  count: number;
  /** A parcela esta dentro do limite que a loja absorve. */
  absorbed: boolean;
  /**
   * Em centavos, sempre do ponto de vista de quem paga a diferença: positivo
   * quando o outro plano e o pior dos dois.
   */
  differenceCents: number;
}

export function planContrast(draft: PaymentDraft, totalCents: number): PlanContrast | null {
  if (!draft.acceptsCard || totalCents <= 0) {
    return null;
  }

  const max = integerOf(draft.maxInstallments);
  const free = integerOf(draft.interestFreeUpTo);

  if (max === null || max < 1 || free === null) {
    return null;
  }

  const other = otherPlan(draft.activeCardPlan);
  const here = feePercentsOf(ratesOfPlan(draft, draft.activeCardPlan), 'link');
  const there = feePercentsOf(ratesOfPlan(draft, other), 'link');

  for (let count = max; count >= 1; count -= 1) {
    const mine = here.get(count);
    const theirs = there.get(count);

    if (mine === undefined || theirs === undefined || mine === theirs) {
      continue;
    }

    const absorbed = count <= Math.min(free, max);

    return {
      other,
      count,
      absorbed,
      differenceCents: absorbed
        ? netOf(totalCents, mine) - netOf(totalCents, theirs)
        : grossUp(totalCents, theirs) - grossUp(totalCents, mine),
    };
  }

  return null;
}

/**
 * A coluna de uma modalidade, pronta para o cálculo.
 *
 * Célula pela metade fica de fora, como ficaria no `PATCH`: a prévia precisa
 * mostrar a lista que a tabela produz hoje, e não a que ela produziria se a
 * dona terminasse de digitar.
 */
function feePercentsOf(rates: readonly RateDraft[], mode: 'link' | 'tap'): Map<number, number> {
  const percents = new Map<number, number>();

  for (const row of rates) {
    if (row.link.trim() === '' || row.tap.trim() === '') {
      continue;
    }

    const percent = percentFromInput(mode === 'link' ? row.link : row.tap);

    if (percent !== null && percent >= 0) {
      percents.set(row.installments, percent);
    }
  }

  return percents;
}

/** O que a prévia do PIX mostra, ou `null` com o PIX desligado. */
export interface PixPreview {
  discountCents: number;
  totalCents: number;
}

/**
 * O total no PIX de um pedido, e quanto o desconto tirou.
 *
 * Copia de `pixQuoteOf` do backend, sem a parte da entrega: aqui o valor
 * digitado e o subtotal de produtos, e o desconto do PIX nunca incide sobre o
 * frete — ele não e margem da loja, e já foi pago a quem leva.
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

/* ---- Números ------------------------------------------------------------------ */

/**
 * Um inteiro escrito a mão, ou `null`.
 *
 * `Number.parseInt` não serve: ele lê `12abc` como `12` e `1,5` como `1`, e
 * os dois entrariam no `PATCH` como se a dona tivesse digitado outra coisa.
 */
function integerOf(value: string): number | null {
  const trimmed = value.trim();

  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Um percentual com até duas casas, ou `null`.
 *
 * Passa por `centsFromInput` porque `1,99%` tem a mesma forma que `R$ 1,99`:
 * ler em centesimos inteiros e dividir por cem uma vez só e o que devolve
 * exatamente `1.99`, e não o `1.9900000000000002` que um `parseFloat` sobre
 * texto com vírgula acaba produzindo depois de qualquer conta.
 */
export function percentFromInput(value: string): number | null {
  const hundredths = centsFromInput(value);

  return hundredths === null ? null : hundredths / 100;
}

/** O caminho de volta: `1.99` vira `1,99`. */
export function percentToInput(value: number): string {
  return centsToInput(Math.round(value * 100));
}
