import { lineKey, type CartLineKey } from './cart.types';
import type { QuoteLine } from './quote.types';

/**
 * "Os valores foram atualizados": como a sacola sabe disso sem guardar preço.
 *
 * Quem monta a sacola numa terca e volta no domingo merece saber que os
 * números não são os mesmos que ele viu. Saber isso exige comparar o preço
 * de hoje com o de antes — e o preço de antes não pode estar guardado, pela
 * regra que governa este módulo inteiro.
 *
 * ## A saída: guardar a impressão digital, não o valor
 *
 * O que vai para o `localStorage` e um `hash` curto de cada preço unitário,
 * por linha. Serve para uma coisa só — dizer "mudou" ou "não mudou" — e não
 * serve para nenhuma outra: `1f3k2a` não soma, não multiplica e não cabe num
 * `formatCents`. Um preço guardado acaba, cedo ou tarde, aparecendo numa
 * tela; um digest não tem como.
 *
 * ## Por linha, e não do carrinho inteiro
 *
 * Um digest único da sacola mudaria ao acrescentar um item — e "você
 * adicionou um perfume" viraria "os preços mudaram". Comparando linha a
 * linha, só as chaves que existem nos dois lados são confrontadas: item novo
 * não tem com o que divergir, item removido some sem alarde, e o aviso sobra
 * apenas para o que mudou de preço de verdade.
 *
 * ## Uma hora de carência
 *
 * O aviso e sobre o tempo que passou, e não sobre o instante. Quem recarrega
 * a página no meio da compra — ou tem duas abas abertas — não pode receber
 * "os valores foram atualizados" a cada leitura. Abaixo de uma hora, a
 * diferença e registrada em silêncio; a partir dai, ela vira o aviso
 * discreto que a sacola mostra uma vez.
 */

/** Antes disto, a mudanca e anotada sem avisar ninguém. */
export const PRICE_NOTICE_MIN_AGE_MS = 60 * 60 * 1000;

const STORAGE_KEY = 'maison-essence.cart.prices';

export interface PriceSnapshot {
  /** Uma impressão digital por linha. Nenhum valor em reais. */
  digests: Record<string, string>;
  /** Quando foi anotado, em milissegundos. */
  at: number;
}

/**
 * A leitura e a escrita são funções separadas, e a separação e o ponto.
 *
 * Quem consome isto precisa **comparar durante o render** — a decisão de
 * mostrar o aviso e derivada, não um estado que um efeito liga depois — e
 * **escrever num efeito**, porque escrever e sincronizar com um sistema
 * externo. Uma função única que fizesse as duas coisas forçaria a escrita
 * para dentro do render ou a comparação para dentro de um efeito, e as duas
 * saídas são piores: a primeira e um efeito colateral no render, a segunda e
 * um `setState` em efeito, que dispara uma segunda renderização por um aviso
 * que já poderia ter nascido pronto.
 */

/** O retrato guardado, ou `null` quando não há nenhum que sirva. */
export function readPriceSnapshot(): PriceSnapshot | null {
  return readRecord();
}

/** Anota os preços de agora. Escreve sempre; não decide nada. */
export function writePriceSnapshot(items: readonly QuoteLine[], now = Date.now()): void {
  writeRecord({ digests: digestsOf(items), at: now });
}

/**
 * Algum preço mudou entre o retrato anterior e estas linhas?
 *
 * Função pura: não lê nem escreve armazenamento. O `false` vale para a
 * primeira sacola deste navegador, para a mudanca recente demais e para tudo
 * o que não pode ser comparado — na dúvida, a sacola fica calada, que e o
 * comportamento certo para um aviso que só tem valor quando e verdadeiro.
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
 * Um digest por linha disponível.
 *
 * A linha indisponível fica de fora: ela volta da cotação com
 * `unitPriceCents` zero quando o produto sumiu do catálogo, e anotar esse
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
    // Armazenamento bloqueado: a sacola funciona igual, só deixa de avisar
    // sobre reajuste na próxima visita.
  }
}

/** Esqueceu a sacola: a anotação de preços vai junto. */
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
 * Escolhido por ser curto de escrever e de ler — não há dependência nova, e
 * a função inteira cabe em cinco linhas. Não e criptografia e não precisa
 * ser: o que se pede dela e que dois preços diferentes deem strings
 * diferentes, e que a string não se pareca com dinheiro.
 */
function hash(text: string): string {
  let value = 0x81_1c_9d_c5;

  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01_00_01_93);
  }

  return (value >>> 0).toString(36);
}
