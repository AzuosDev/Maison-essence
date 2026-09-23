import { bestMatch, similarity } from './fuzzy.js';

export interface ProductLike {
  slug: string;
  name: string;
  categorySlugs: readonly string[];
  sourceCatalog: string;
}

export type MatchKind = 'exact' | 'approximate';

export interface MatchResult {
  product: ProductLike;
  kind: MatchKind;
  score: number;
}

/**
 * Palavras do nome de um produto, na ordem, sem normalizar — o suficiente
 * para achar prefixo/sufixo comuns entre produtos da mesma categoria.
 */
function wordsOf(name: string): string[] {
  return name.trim().split(/\s+/);
}

/** Quantas palavras, do inicio, `a` e `b` tem em comum (comparando sem acento/caixa). */
function commonLeadingWords(lists: readonly string[][]): number {
  if (lists.length === 0) {
    return 0;
  }

  const shortest = Math.min(...lists.map((words) => words.length)) - 1; // deixa ao menos 1 palavra de resto
  let count = 0;

  for (let i = 0; i < shortest; i += 1) {
    const key = normalize(lists[0]![i]!);
    const allMatch = lists.every((words) => normalize(words[i]!) === key);

    if (!allMatch) {
      break;
    }

    count += 1;
  }

  return count;
}

function commonTrailingWords(lists: readonly string[][]): number {
  const reversed = lists.map((words) => [...words].reverse());

  return commonLeadingWords(reversed);
}

function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * O "resto" do nome de cada produto, tirando o prefixo e o sufixo que todo
 * produto da mesma categoria compartilha.
 *
 * Todo produto de `body-splash-masculino` comeca com "Body Splash"; todo
 * produto de `miniaturas-femininas` termina com "25ml". O catalogo impresso
 * so mostra o meio ("Asad", "Fakhar Rose") — e e contra esse meio que a
 * correspondencia precisa rodar, ou "Asad" nunca bate com "Body Splash Asad".
 *
 * O prefixo/sufixo nao e uma tabela escrita a mao por categoria: e descoberto
 * comparando os nomes dos produtos daquela categoria entre si. Se o catalogo
 * ganhar uma categoria nova amanha, a funcao continua funcionando sem
 * precisar de uma linha nova aqui.
 */
export function remaindersOf(products: readonly ProductLike[]): Map<ProductLike, string> {
  const wordLists = products.map((product) => wordsOf(product.name));
  const prefixLength = products.length > 1 ? commonLeadingWords(wordLists) : 0;
  const suffixLength = products.length > 1 ? commonTrailingWords(wordLists) : 0;

  const result = new Map<ProductLike, string>();

  products.forEach((product, index) => {
    const words = wordLists[index]!;
    const end = words.length - suffixLength;
    const remainder = words.slice(prefixLength, Math.max(prefixLength, end));

    result.set(product, remainder.length > 0 ? remainder.join(' ') : product.name);
  });

  return result;
}

/**
 * Casa um texto extraido do PDF com um produto.
 *
 * Primeiro tenta dentro do grupo indicado (produtos da categoria que a
 * secao da pagina sugere) contra o "resto" do nome. So sai desse grupo para
 * o catalogo inteiro quando nada bate — a categoria errada gera falso
 * positivo com mais facilidade do que a falta de categoria gera falso
 * negativo.
 */
export function matchProduct(
  rawText: string,
  group: readonly ProductLike[],
  wholeCatalog: readonly ProductLike[],
  threshold: number,
): MatchResult | null {
  const target = normalize(rawText).replace(/[^a-z0-9]+/g, ' ').trim();

  if (target === '') {
    return null;
  }

  const inGroup = tryMatch(target, group, remaindersOf(group), threshold);

  if (inGroup !== null) {
    return inGroup;
  }

  // Sem grupo (secao nao resolvida) ou nada bateu nele: tenta contra o nome
  // completo de todo o catalogo de origem, sem tirar prefixo/sufixo — e o
  // que sobra quando a pista de secao falhou.
  const wholeNames = new Map(wholeCatalog.map((product) => [product, product.name] as const));

  return tryMatch(target, wholeCatalog, wholeNames, threshold);
}

function tryMatch(
  target: string,
  candidates: readonly ProductLike[],
  keyOf: ReadonlyMap<ProductLike, string>,
  threshold: number,
): MatchResult | null {
  if (candidates.length === 0) {
    return null;
  }

  const keyed = candidates.map((product) => ({ product, key: normalize(keyOf.get(product) ?? product.name) }));

  const exact = keyed.find((entry) => entry.key === target);

  if (exact !== undefined) {
    return { product: exact.product, kind: 'exact', score: 1 };
  }

  const match = bestMatch(target, keyed, (entry) => entry.key);

  if (match !== null && match.score >= threshold) {
    return { product: match.candidate.product, kind: 'approximate', score: match.score };
  }

  return null;
}

/** So para testes/depuracao: a nota de semelhanca entre dois textos, exposta direto. */
export const rawSimilarity = similarity;
