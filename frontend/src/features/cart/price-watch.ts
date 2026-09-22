import { lineKey, type CartLineKey } from './cart.types';
import type { QuoteLine } from './quote.types';

/**
 * "Os valores foram atualizados": como a sacola sabe disso sem guardar preco.
 *
 * Quem monta a sacola numa terca e volta no domingo merece saber que os
 * numeros nao sao os mesmos que ele viu. Saber isso exige comparar o preco
 * de hoje com o de antes — e o preco de antes nao pode estar guardado, pela
 * regra que governa este modulo inteiro.
 *
 * ## A saida: guardar a impressao digital, nao o valor
 *
 * O que vai para o `localStorage` e um `hash` curto de cada preco unitario,
 * por linha. Serve para uma coisa so — dizer "mudou" ou "nao mudou" — e nao
 * serve para nenhuma outra: `1f3k2a` nao soma, nao multiplica e nao cabe num
 * `formatCents`. Um preco guardado acaba, cedo ou tarde, aparecendo numa
 * tela; um digest nao tem como.
 *
 * ## Por linha, e nao do carrinho inteiro
 *
 * Um digest unico da sacola mudaria ao acrescentar um item — e "voce
 * adicionou um perfume" viraria "os precos mudaram". Comparando linha a
 * linha, so as chaves que existem nos dois lados sao confrontadas: item novo
 * nao tem com o que divergir, item removido some sem alarde, e o aviso sobra
 * apenas para o que mudou de preco de verdade.
 *
 * ## Uma hora de carencia
 *
 * O aviso e sobre o tempo que passou, e nao sobre o instante. Quem recarrega
 * a pagina no meio da compra — ou tem duas abas abertas — nao pode receber
 * "os valores foram atualizados" a cada leitura. Abaixo de uma hora, a
 * diferenca e registrada em silencio; a partir dai, ela vira o aviso
 * discreto que a sacola mostra uma vez.
 */

/** Antes disto, a mudanca e anotada sem avisar ninguem. */
export const PRICE_NOTICE_MIN_AGE_MS = 60 * 60 * 1000;

const STORAGE_KEY = 'maison-essence.cart.prices';

export interface PriceSnapshot {
  /** Uma impressao digital por linha. Nenhum valor em reais. */
  digests: Record<string, string>;
  /** Quando foi anotado, em milissegundos. */
  at: number;
}

/**
 * A leitura e a escrita sao funcoes separadas, e a separacao e o ponto.
 *
 * Quem consome isto precisa **comparar durante o render** — a decisao de
 * mostrar o aviso e derivada, nao um estado que um efeito liga depois — e
 * **escrever num efeito**, porque escrever e sincronizar com um sistema
 * externo. Uma funcao unica que fizesse as duas coisas forcaria a escrita
 * para dentro do render ou a comparacao para dentro de um efeito, e as duas
 * saidas sao piores: a primeira e um efeito colateral no render, a segunda e
 * um `setState` em efeito, que dispara uma segunda renderizacao por um aviso
 * que ja poderia ter nascido pronto.
 */

/** O retrato guardado, ou `null` quando nao ha nenhum que sirva. */
export function readPriceSnapshot(): PriceSnapshot | null {
  return readRecord();
}

/** Anota os precos de agora. Escreve sempre; nao decide nada. */
export function writePriceSnapshot(items: readonly QuoteLine[], now = Date.now()): void {
  writeRecord({ digests: digestsOf(items), at: now });
}

/**
 * Algum preco mudou entre o retrato anterior e estas linhas?
 *
 * Funcao pura: nao le nem escreve armazenamento. O `false` vale para a
 * primeira sacola deste navegador, para a mudanca recente demais e para tudo
 * o que nao pode ser comparado — na duvida, a sacola fica calada, que e o
 * comportamento certo para um aviso que so tem valor quando e verdadeiro.
 */
export function pricesChangedSince(
  before: PriceSnapshot | null,
  items: readonly QuoteLine[],
  now = Date.now(),
): boolean {
  if (before === null || now - before.at < PRICE_NOTICE_MIN_AGE_MS) {
    return false;
  }

  return hasChange(before.digests, digestsOf(items));
}

/** Alguma chave presente nos dois lados mudou de digest. */
function hasChange(before: Record<string, string>, after: Record<string, string>): boolean {
  return Object.entries(after).some(([key, digest]) => {
    const earlier = before[key];

    return earlier !== undefined && earlier !== digest;
  });
}

/**
 * Um digest por linha disponivel.
 *
 * A linha indisponivel fica de fora: ela volta da cotacao com
 * `unitPriceCents` zero quando o produto sumiu do catalogo, e anotar esse
 * zero faria o produto reativado depois parecer um reajuste.
 */
function digestsOf(items: readonly QuoteLine[]): Record<string, string> {
  const digests: Record<string, string> = {};

  for (const item of items) {
    if (!item.unavailable) {
      digests[keyOf(item)] = hash(String(item.unitPriceCents));
    }
  }

  return digests;
}

function keyOf(item: QuoteLine): CartLineKey {
  return lineKey(item.productId, item.variantId);
}

function readRecord(): PriceSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PriceSnapshot>;

    return typeof parsed.at === 'number' && isPlainRecord(parsed.digests)
      ? { digests: parsed.digests, at: parsed.at }
      : null;
  } catch {
    return null;
  }
}

function writeRecord(record: PriceSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Armazenamento bloqueado: a sacola funciona igual, so deixa de avisar
    // sobre reajuste na proxima visita.
  }
}

/** Esqueceu a sacola: a anotacao de precos vai junto. */
export function forgetPrices(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ver acima.
  }
}

function isPlainRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

/**
 * FNV-1a de 32 bits, em base 36.
 *
 * Escolhido por ser curto de escrever e de ler — nao ha dependencia nova, e
 * a funcao inteira cabe em cinco linhas. Nao e criptografia e nao precisa
 * ser: o que se pede dela e que dois precos diferentes deem strings
 * diferentes, e que a string nao se pareca com dinheiro.
 */
function hash(text: string): string {
  let value = 0x81_1c_9d_c5;

  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01_00_01_93);
  }

  return (value >>> 0).toString(36);
}
