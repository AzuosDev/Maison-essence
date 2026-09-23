/**
 * Distancia de Levenshtein e uma nota de semelhanca a partir dela.
 *
 * Sem dependencia nova: e uma funcao pura de ~20 linhas, e o projeto ja evita
 * SDK quando um `fetch` ou um algoritmo pequeno resolve (ver `CloudinaryService`).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current.push(
        Math.min(
          current[j - 1]! + 1,
          previous[j]! + 1,
          previous[j - 1]! + cost,
        ),
      );
    }

    previous = current;
  }

  return previous[b.length]!;
}

/**
 * Semelhanca entre duas strings, de 0 a 1.
 *
 * `1 - distancia / tamanho-maior`, a mesma formula do `similar_text` do PHP e
 * de boa parte das bibliotecas de fuzzy match. Duas strings vazias sao
 * identicas por definicao (nota 1).
 */
export function similarity(a: string, b: string): number {
  const longer = Math.max(a.length, b.length);

  if (longer === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(a, b) / longer;
}

/** O melhor candidato de uma lista, com sua nota — ou `null` se a lista for vazia. */
export function bestMatch<T>(
  target: string,
  candidates: readonly T[],
  keyOf: (candidate: T) => string,
): { candidate: T; score: number } | null {
  let best: { candidate: T; score: number } | null = null;

  for (const candidate of candidates) {
    const score = similarity(target, keyOf(candidate));

    if (best === null || score > best.score) {
      best = { candidate, score };
    }
  }

  return best;
}
