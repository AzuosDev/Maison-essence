import {
  centsFromInput,
  centsToInput,
  dateInputValue,
  dayEndISO,
  dayStartISO,
  formatCents,
} from '@/lib/format';
import {
  COUPON_LIMITS,
  type AdminCoupon,
  type CouponStatus,
  type CreateCouponInput,
  type UpdateCouponInput,
} from './admin.types';

/**
 * O cupom enquanto esta sendo editado, e as contas que a tela faz com ele.
 *
 * ## Por que o rascunho guarda texto
 *
 * A mesma razão da tabela de taxas e do cadastro de produto: no banco o
 * desconto e um inteiro — 20, ou 3000 centavos —, na tela e o que a dona esta
 * digitando, e no meio do caminho ele passa por `2`, `30,` e `3`. O rascunho
 * guarda texto, e a conversão acontece uma vez, na saída, depois de validar.
 *
 * ## Um desconto, nunca dois
 *
 * `kind` existe porque percentual e valor em reais são a mesma decisão vista
 * de dois jeitos, e não dois campos a preencher. O servidor recusa os dois
 * juntos com uma frase só (`ONE_DISCOUNT_MESSAGE`); a tela recusa antes, e o
 * faz escolhendo — um grupo de duas opções, e o campo do outro tipo nem fica
 * na frente de quem esta preenchendo.
 *
 * ## O que esta aqui e não na tela
 *
 * As três perguntas que a tela faz e que teriam duas respostas se morassem em
 * dois componentes: em que grupo este cupom cai, qual campanha a home esta
 * anunciando de verdade, e como a régua de usos se divide. A última e a que
 * mais pesa — ela e a razão de a feature existir, e errar a conta dela por
 * meio ponto percentual não quebra nada e mente para quem decide.
 */

/* ---- O rascunho ----------------------------------------------------------- */

/** Qual dos dois descontos este cupom dá. */
export type DiscountKind = 'percent' | 'amount';

export interface CouponDraft {
  /** Caixa alta, sem espaço: e o que a cliente digita no celular. */
  code: string;
  title: string;
  tagline: string;
  kind: DiscountKind;
  /** `20`, como inteiro digitado. Vale só quando `kind` e `percent`. */
  percent: string;
  /** `30,00`. Vale só quando `kind` e `amount`. */
  amount: string;
  /** Vazio e "sem teto": o cupom vale enquanto a janela estiver aberta. */
  maxUses: string;
  /** `2026-11-20`, como o `<input type="date">` entrega. */
  startsOn: string;
  endsOn: string;
  /** Vazia e a loja inteira. */
  productIds: string[];
  showOnHome: boolean;
  isActive: boolean;
}

export type CouponErrors = Partial<Record<keyof CouponDraft, string>>;

/** O cupom salvo, aberto para edição. */
export function draftFromCoupon(coupon: AdminCoupon): CouponDraft {
  return {
    code: coupon.code,
    title: coupon.title,
    tagline: coupon.tagline,
    kind: coupon.amountOffCents === null ? 'percent' : 'amount',
    percent: coupon.percentOff === null ? '' : String(coupon.percentOff),
    amount: coupon.amountOffCents === null ? '' : centsToInput(coupon.amountOffCents),
    maxUses: coupon.maxUses === null ? '' : String(coupon.maxUses),
    startsOn: dateInputValue(coupon.startsAt),
    endsOn: dateInputValue(coupon.endsAt),
    productIds: [...coupon.productIds],
    showOnHome: coupon.showOnHome,
    isActive: coupon.isActive,
  };
}

/**
 * Um cupom novo.
 *
 * Nasce percentual porque e o desconto que esta loja anuncia — "20% OFF" e o
 * que vai para o story —, e nasce ligado e sem teto: quem cria um cupom quer
 * que ele valha. O que não nasce ligado e o anúncio na home, que e uma segunda
 * decisão e tira a vaga de outra campanha.
 */
export function emptyCouponDraft(): CouponDraft {
  return {
    code: '',
    title: '',
    tagline: '',
    kind: 'percent',
    percent: '',
    amount: '',
    maxUses: '',
    startsOn: '',
    endsOn: '',
    productIds: [],
    showOnHome: false,
    isActive: true,
  };
}

/**
 * O código, do jeito que ele e gravado, enquanto se digita.
 *
 * Caixa alta e só letra e número, porque e assim que o servidor o aceita
 * (`COUPON_CODE_PATTERN`) e assim que ele e ditado no WhatsApp. Corrigir
 * durante a digitação, e não recusar depois, poupa a dona de descobrir no
 * envio que o hífen que ela pôs em `BLACK-FRIDAY` não era permitido.
 */
export function normalizeCouponCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * O que impede o cupom de ser salvo.
 *
 * Confere o que o servidor conferiria, e nada além — tela que inventa regra
 * própria recusa o que a API aceitaria, e quem esta do outro lado não tem como
 * saber qual das duas esta errada.
 */
export function validateCoupon(draft: CouponDraft): CouponErrors {
  const errors: CouponErrors = {};

  const code = normalizeCouponCode(draft.code);

  if (code.length < COUPON_LIMITS.codeMin) {
    errors.code = `O código tem no mínimo ${String(COUPON_LIMITS.codeMin)} caracteres, só letras e números.`;
  } else if (code.length > COUPON_LIMITS.codeMax) {
    errors.code = `O código passa de ${String(COUPON_LIMITS.codeMax)} caracteres.`;
  }

  if (draft.title.trim().length < 2) {
    errors.title = 'Escreva o nome da campanha. E ele que a home anuncia.';
  } else if (draft.title.trim().length > COUPON_LIMITS.title) {
    errors.title = `O nome passa de ${String(COUPON_LIMITS.title)} caracteres.`;
  }

  if (draft.tagline.length > COUPON_LIMITS.tagline) {
    errors.tagline = `A linha passa de ${String(COUPON_LIMITS.tagline)} caracteres.`;
  }

  if (draft.kind === 'percent') {
    const percent = Number.parseInt(draft.percent.trim(), 10);

    if (draft.percent.trim() === '' || !Number.isInteger(percent)) {
      errors.percent = 'Escreva quantos por cento o cupom tira.';
    } else if (percent < COUPON_LIMITS.percentMin || percent > COUPON_LIMITS.percentMax) {
      errors.percent = `O desconto vai de ${String(COUPON_LIMITS.percentMin)}% a ${String(COUPON_LIMITS.percentMax)}%.`;
    }
  } else {
    const amount = centsFromInput(draft.amount);

    if (draft.amount.trim() === '' || amount === null || amount < 1) {
      errors.amount = 'Escreva quantos reais o cupom tira.';
    } else if (amount > COUPON_LIMITS.amountOffCents) {
      errors.amount = 'Esse valor passa do limite do sistema.';
    }
  }

  // Teto em branco e aceito: vira `null`, que e "sem limite de usos".
  if (draft.maxUses.trim() !== '') {
    const uses = Number.parseInt(draft.maxUses.trim(), 10);

    if (!Number.isInteger(uses) || uses < 1) {
      errors.maxUses = 'Escreva quantos cupons existem, ou deixe em branco para não ter limite.';
    } else if (uses > COUPON_LIMITS.maxUses) {
      errors.maxUses = `O limite máximo e de ${String(COUPON_LIMITS.maxUses)} cupons.`;
    }
  }

  if (draft.startsOn !== '' && draft.endsOn !== '' && endsInstant(draft) <= startsInstant(draft)) {
    errors.endsOn = 'A campanha termina antes de começar. Confira as datas.';
  }

  if (draft.productIds.length > COUPON_LIMITS.products) {
    errors.productIds = `Um cupom aponta no máximo ${String(COUPON_LIMITS.products)} produtos.`;
  }

  return errors;
}

export function hasCouponErrors(errors: CouponErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * O aviso de teto apertado, que não impede salvar.
 *
 * Baixar o limite para menos do que já foi comprometido e uma decisão
 * legitima — e como se encerra uma campanha que vendeu demais sem desligá-la.
 * O servidor aceita, e `remainingUses` simplesmente vai a zero. O que não
 * pode acontecer e isso virar surpresa, então a frase aparece antes de salvar.
 *
 * Vazio quando não há aviso a dar, e não `null`: quem chama escreve a linha
 * sem perguntar nada.
 */
export function maxUsesWarning(draft: CouponDraft, coupon: AdminCoupon | null): string {
  if (coupon === null || draft.maxUses.trim() === '') {
    return '';
  }

  const uses = Number.parseInt(draft.maxUses.trim(), 10);
  const committed = coupon.usedCount + coupon.holdingCount;

  if (!Number.isInteger(uses) || uses >= committed) {
    return '';
  }

  return `Esta campanha já comprometeu ${String(committed)} ${committed === 1 ? 'cupom' : 'cupons'}. Com o limite em ${String(uses)}, ela esgota na hora e o código para de valer no fechamento.`;
}

/** O corpo do `POST`. A validação já passou quando esta função e chamada. */
export function couponDraftToCreate(draft: CouponDraft): CreateCouponInput {
  return {
    code: normalizeCouponCode(draft.code),
    title: draft.title.trim(),
    tagline: draft.tagline.trim(),
    percentOff: percentOf(draft),
    amountOffCents: amountOf(draft),
    maxUses: maxUsesOf(draft),
    startsAt: draft.startsOn === '' ? null : dayStartISO(draft.startsOn),
    endsAt: draft.endsOn === '' ? null : dayEndISO(draft.endsOn),
    productIds: [...draft.productIds],
    showOnHome: draft.showOnHome,
    isActive: draft.isActive,
  };
}

/**
 * Só o que mudou em relação ao que veio do servidor.
 *
 * Devolve `null` quando nada mudou, e quem chama usa isso para não gastar uma
 * chamada — abrir a campanha para conferir e fechar e um gesto comum.
 *
 * A troca de tipo de desconto manda **os dois** campos, sempre: passar de 20%
 * para R$ 30 e `percentOff: null` junto de `amountOffCents: 3000`, porque o
 * schema recusa um cupom com os dois preenchidos. Mandar só o novo deixaria o
 * antigo no lugar e a gravação seria recusada com uma frase que não explica
 * nada para quem só trocou de opção na tela.
 */
export function couponChangesOf(draft: CouponDraft, coupon: AdminCoupon): UpdateCouponInput | null {
  const changes: UpdateCouponInput = {};

  const code = normalizeCouponCode(draft.code);
  const title = draft.title.trim();
  const tagline = draft.tagline.trim();
  const percent = percentOf(draft);
  const amount = amountOf(draft);
  const maxUses = maxUsesOf(draft);
  const startsAt = draft.startsOn === '' ? null : dayStartISO(draft.startsOn);
  const endsAt = draft.endsOn === '' ? null : dayEndISO(draft.endsOn);

  if (code !== coupon.code) {
    changes.code = code;
  }

  if (title !== coupon.title) {
    changes.title = title;
  }

  if (tagline !== coupon.tagline) {
    changes.tagline = tagline;
  }

  if (percent !== coupon.percentOff || amount !== coupon.amountOffCents) {
    changes.percentOff = percent;
    changes.amountOffCents = amount;
  }

  if (maxUses !== coupon.maxUses) {
    changes.maxUses = maxUses;
  }

  /*
   * As datas se comparam por dia, e não por instante.
   *
   * O campo e um `<input type="date">`: ele só sabe dizer dia, e e por isso que
   * a comparação tem de ser no dia. Comparar o instante faria qualquer cupom
   * cujo `endsAt` gravado não seja exatamente o fim do dia local — um criado de
   * outro fuso, um semeado por script — aparecer como alterado só por ter sido
   * aberto, e "abrir e fechar" gravaria no servidor. E a mesma regra que os
   * banners agendados já seguem, comparando `startsOn` e `endsOn`.
   */
  if (draft.startsOn !== dateInputValue(coupon.startsAt)) {
    changes.startsAt = startsAt;
  }

  if (draft.endsOn !== dateInputValue(coupon.endsAt)) {
    changes.endsAt = endsAt;
  }

  if (!sameIds(draft.productIds, coupon.productIds)) {
    changes.productIds = [...draft.productIds];
  }

  if (draft.showOnHome !== coupon.showOnHome) {
    changes.showOnHome = draft.showOnHome;
  }

  if (draft.isActive !== coupon.isActive) {
    changes.isActive = draft.isActive;
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/* ---- As palavras do estado ------------------------------------------------- */

/**
 * O estado em feminino, porque o que a tela mostra e a campanha.
 *
 * "Desligada" e não "Pausada": pausar sugere que volta sozinha, e não volta —
 * quem desligou precisa ligar de novo. E "Encerrada" em vez de "Vencida"
 * porque a data que passou não e culpa de ninguém.
 */
export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  live: 'No ar',
  scheduled: 'Agendada',
  ended: 'Encerrada',
  exhausted: 'Esgotada',
  paused: 'Desligada',
};

/**
 * Os três grupos da tela, na ordem em que ela os desenha.
 *
 * ## Por que a esgotada fica em "No ar"
 *
 * Porque ela **esta** no ar: dentro do prazo, ligada, aparecendo para quem
 * tiver o código. O que falta e vaga. Empurrá-la para "Encerradas" a esconderia
 * no pé da página justamente no dia em que ela precisa de uma decisão — subir
 * o limite ou encerrar de vez —, e e a dona quem toma essa decisão em cima da
 * hora, num sábado de campanha.
 *
 * ## Por que a desligada fica em "Encerradas"
 *
 * O grupo responde a uma pergunta só: esta rodando? Desligada não roda. O selo
 * do cartão conta o resto, e a diferença entre as duas importa — a desligada
 * volta com um clique, a vencida precisa de datas novas.
 */
export const COUPON_GROUPS = ['live', 'scheduled', 'ended'] as const;

export type CouponGroup = (typeof COUPON_GROUPS)[number];

export const COUPON_GROUP_LABELS: Record<CouponGroup, string> = {
  live: 'No ar',
  scheduled: 'Agendadas',
  ended: 'Encerradas',
};

const GROUP_OF: Record<CouponStatus, CouponGroup> = {
  live: 'live',
  exhausted: 'live',
  scheduled: 'scheduled',
  ended: 'ended',
  paused: 'ended',
};

export function couponGroupOf(coupon: AdminCoupon): CouponGroup {
  return GROUP_OF[coupon.status];
}

/**
 * A lista repartida nos três grupos, cada um na ordem que serve a ele.
 *
 * As do ar vem pela que acaba primeiro, que e a ordem da urgência e a mesma
 * regra que escolhe a vaga da home. As agendadas vem pela que começa primeiro,
 * que e a ordem em que elas vão virar notícia. As encerradas vem pela mais
 * recente, porque e sempre a última campanha que alguém quer reabrir ou copiar.
 */
export function groupCoupons(
  coupons: readonly AdminCoupon[],
): Record<CouponGroup, AdminCoupon[]> {
  const groups: Record<CouponGroup, AdminCoupon[]> = { live: [], scheduled: [], ended: [] };

  for (const coupon of coupons) {
    groups[couponGroupOf(coupon)].push(coupon);
  }

  groups.live.sort((first, second) => byDeadline(first, second));
  groups.scheduled.sort((first, second) => instantOf(first.startsAt) - instantOf(second.startsAt));
  groups.ended.sort((first, second) => instantOf(second.updatedAt) - instantOf(first.updatedAt));

  return groups;
}

/**
 * Qual campanha a home esta anunciando de verdade.
 *
 * Copia fiel de `liveCampaign` no servidor, e a fidelidade e o ponto: a home
 * anuncia **uma** campanha, entre as que estão no ar com o anúncio ligado, e e
 * a que acaba primeiro. Ligar o interruptor em três campanhas não põe três
 * faixas na home — põe uma, e as outras duas esperam a vez.
 *
 * Sem isto, o painel marcaria as três como "na home" e a dona passaria a tarde
 * procurando por que a campanha que ela acabou de anunciar não aparece. E o
 * mesmo defeito que o banner agendado já resolveu com os quatro estados: o
 * "salvei e não apareceu" e o que mais assusta nesta tela.
 *
 * A esgotada não entra na disputa, como no servidor: anunciar na home um código
 * que o fechamento recusa e pior que não anunciar nada.
 */
export function announcedCouponId(coupons: readonly AdminCoupon[]): string | null {
  const candidates = coupons.filter(
    (coupon) => coupon.showOnHome && coupon.status === 'live',
  );

  return candidates.toSorted((first, second) => byDeadline(first, second))[0]?.id ?? null;
}

/* ---- A régua de usos ------------------------------------------------------- */

/**
 * Como a barra se divide, em porcentagem do teto.
 *
 * Três fatias que somam 100: vendidas, seguradas por pedido aberto e livres.
 * Devolve `null` para cupom sem teto — não há barra a desenhar quando não há
 * fim, e uma barra que nunca enche seria uma promessa de limite que não existe.
 *
 * As fatias são recortadas, e não arredondadas cada uma por si: dois
 * arredondamentos independentes somariam 101% e empurrariam a terceira fatia
 * para fora da barra. A primeira arredonda, a segunda arredonda a soma e
 * subtrai, e a última e o que falta para fechar — a mesma aritmética que o
 * desconto por quantidade usa para fechar o centavo.
 */
export interface UsesRuler {
  maxUses: number;
  usedCount: number;
  holdingCount: number;
  /** O que sobra depois de vendidos e segurados. Nunca negativo. */
  remaining: number;
  /** `0`–`100`. */
  usedPercent: number;
  holdingPercent: number;
}

export function usesRulerOf(coupon: AdminCoupon): UsesRuler | null {
  if (coupon.maxUses === null) {
    return null;
  }

  const max = coupon.maxUses;
  const used = Math.min(coupon.usedCount, max);
  const holding = Math.min(coupon.holdingCount, max - used);

  const usedPercent = Math.round((used / max) * 100);
  const bothPercent = Math.round(((used + holding) / max) * 100);

  return {
    maxUses: max,
    usedCount: coupon.usedCount,
    holdingCount: coupon.holdingCount,
    remaining: Math.max(max - used - holding, 0),
    usedPercent,
    holdingPercent: bothPercent - usedPercent,
  };
}

/**
 * A régua em palavras, que e a versão que o leitor de tela recebe.
 *
 * A barra e desenho de um dado que já esta escrito aqui, e por isso ela sai do
 * fluxo acessível inteira: quem ouve a tela recebe esta frase, que diz mais que
 * "barra de progresso, 54 por cento".
 *
 * "em pedidos abertos" e não "segurando": o que a dona vê no painel de pedidos
 * e o status Processando, e e com essa palavra que ela pensa no que ainda não
 * virou venda.
 */
export function usesSentence(coupon: AdminCoupon): string {
  const sold = `${String(coupon.usedCount)} ${coupon.usedCount === 1 ? 'vendido' : 'vendidos'}`;

  const holding =
    coupon.holdingCount === 0
      ? ''
      : `, ${String(coupon.holdingCount)} em ${coupon.holdingCount === 1 ? 'pedido aberto' : 'pedidos abertos'}`;

  if (coupon.maxUses === null) {
    return `${sold}${holding}, sem limite de usos`;
  }

  const remaining = coupon.remainingUses ?? 0;

  const left =
    remaining === 0
      ? 'nenhum disponível'
      : `${String(remaining)} ${remaining === 1 ? 'disponível' : 'disponíveis'}`;

  return `${sold}${holding}, ${left} de ${String(coupon.maxUses)}`;
}

/* ---- As outras frases da tela ---------------------------------------------- */

/**
 * O prazo da campanha, como se lê de relance.
 *
 * O dia escrito e o último em que o cupom vale, e não o instante em que ele
 * morre: o servidor guarda o fim como 23:59:59 do dia escolhido, e "até 30/11"
 * e a leitura verdadeira disso. Dizer "até 01/12" porque e o que o ISO sugere
 * faria a dona achar que ganhou um dia.
 */
export function couponWindowLabel(coupon: AdminCoupon): string {
  const starts = coupon.startsAt === null ? '' : shortDay(coupon.startsAt);
  const ends = coupon.endsAt === null ? '' : shortDay(coupon.endsAt);

  if (starts === '' && ends === '') {
    return 'Sem prazo';
  }

  if (ends === '') {
    return `A partir de ${starts}`;
  }

  return starts === '' ? `Até ${ends}` : `${starts} a ${ends}`;
}

/** Quantos produtos a campanha alcança, ou a loja inteira. */
export function couponScopeLabel(coupon: AdminCoupon): string {
  if (coupon.wholeStore) {
    return 'Loja inteira';
  }

  return coupon.productIds.length === 1 ? '1 produto' : `${String(coupon.productIds.length)} produtos`;
}

/**
 * O desconto escrito, enquanto ele ainda e rascunho.
 *
 * Copia de `discountLabel` do servidor, e existe porque a pré-visualização da
 * home precisa dizer "20% OFF" antes de haver cupom salvo. Vazio enquanto o
 * campo não tem número: um "0% OFF" piscando na pré-visualização a cada tecla
 * mostraria um desconto que ninguém pediu.
 */
export function draftDiscountLabel(draft: CouponDraft): string {
  if (draft.kind === 'percent') {
    const percent = Number.parseInt(draft.percent.trim(), 10);

    return Number.isInteger(percent) && percent > 0 ? `${String(percent)}% OFF` : '';
  }

  const amount = centsFromInput(draft.amount);

  return amount !== null && amount > 0 ? `${formatCents(amount)} OFF` : '';
}

/**
 * A linha de contagem do alto da tela.
 *
 * Conta as que estão no ar e, separada, quantas delas esgotaram — porque uma
 * campanha esgotada no meio de três no ar e a notícia da tela, e não um detalhe
 * do cartão.
 */
export function couponsSummary(coupons: readonly AdminCoupon[] | undefined): string {
  if (coupons === undefined) {
    return 'Carregando os cupons';
  }

  if (coupons.length === 0) {
    return 'Nenhum cupom cadastrado';
  }

  const live = coupons.filter((coupon) => coupon.status === 'live').length;
  const exhausted = coupons.filter((coupon) => coupon.status === 'exhausted').length;
  const scheduled = coupons.filter((coupon) => coupon.status === 'scheduled').length;

  const parts = [
    live === 1 ? '1 campanha no ar' : `${String(live)} campanhas no ar`,
    ...(exhausted === 0 ? [] : [`${String(exhausted)} esgotada${exhausted === 1 ? '' : 's'}`]),
    ...(scheduled === 0 ? [] : [`${String(scheduled)} agendada${scheduled === 1 ? '' : 's'}`]),
  ];

  return parts.join(', ');
}

/* ---- As contas de dentro --------------------------------------------------- */

function percentOf(draft: CouponDraft): number | null {
  if (draft.kind !== 'percent') {
    return null;
  }

  const percent = Number.parseInt(draft.percent.trim(), 10);

  return Number.isInteger(percent) ? percent : null;
}

function amountOf(draft: CouponDraft): number | null {
  return draft.kind === 'amount' ? centsFromInput(draft.amount) : null;
}

function maxUsesOf(draft: CouponDraft): number | null {
  if (draft.maxUses.trim() === '') {
    return null;
  }

  const uses = Number.parseInt(draft.maxUses.trim(), 10);

  return Number.isInteger(uses) ? uses : null;
}

function startsInstant(draft: CouponDraft): number {
  return new Date(dayStartISO(draft.startsOn)).getTime();
}

function endsInstant(draft: CouponDraft): number {
  return new Date(dayEndISO(draft.endsOn)).getTime();
}

/**
 * A que acaba primeiro vem na frente, e a sem prazo vai para o fim.
 *
 * `null` em `endsAt` não e "acaba agora" nem "acaba já": e "até segunda
 * ordem", e uma campanha permanente na frente da que termina hoje à noite
 * desperdiçaria as duas. Entre duas sem prazo, vence a mais nova — a novidade
 * e o que a vitrine tem a dizer. E a mesma ordem de `liveForHome`.
 */
function byDeadline(first: AdminCoupon, second: AdminCoupon): number {
  if (first.endsAt === null || second.endsAt === null) {
    if (first.endsAt === second.endsAt) {
      return instantOf(second.createdAt) - instantOf(first.createdAt);
    }

    return first.endsAt === null ? 1 : -1;
  }

  return instantOf(first.endsAt) - instantOf(second.endsAt);
}

function instantOf(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const instant = new Date(value).getTime();

  return Number.isNaN(instant) ? 0 : instant;
}

/** `30/11`, sem o ano: a campanha e deste ano, e o ano só ocuparia a linha. */
function shortDay(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}


function sameIds(draft: readonly string[], saved: readonly string[]): boolean {
  return draft.length === saved.length && draft.every((id, index) => id === saved[index]);
}
