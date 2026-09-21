import { slugify } from '../../database/slug.js';

/** Teto declarado no schema da variante. */
export const MAX_SKU_LENGTH = 40;

/** Quantos sufixos numericos tentar antes de desistir e sortear um. */
const MAX_SKU_ATTEMPTS = 50;

/**
 * Monta o SKU de uma variante a partir do nome do produto e do label.
 *
 * `Asad Lattafa` + `100 ml` vira `ASAD-LATTAFA-100-ML`. O SKU e o que a dona
 * le na etiqueta e dita no WhatsApp, entao ele precisa ser reconhecivel — um
 * codigo aleatorio seria unico e inutil. Reaproveita o `slugify` para tirar
 * acento e pontuacao, e so troca a caixa.
 *
 * `taken` sao os SKUs ja usados no mesmo produto; havendo choque, o sufixo
 * numerico entra. A unicidade e dentro do produto, nao do catalogo: dois
 * produtos podem ter a variante `100-ML` sem que isso confunda ninguem.
 */
export function generateSku(
  productName: string,
  label: string,
  taken: ReadonlySet<string>,
): string {
  const base = toSkuPart([productName, label].filter((part) => part.length > 0).join('-'));

  if (base.length === 0) {
    // Nome so de simbolos: sem base reconhecivel, resta um codigo qualquer.
    return withSuffix('SKU', String(taken.size + 1));
  }

  if (!taken.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix <= MAX_SKU_ATTEMPTS; suffix += 1) {
    const candidate = withSuffix(base, String(suffix));

    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return withSuffix(base, Math.random().toString(36).slice(2, 6).toUpperCase());
}

function toSkuPart(value: string): string {
  return slugify(value).toUpperCase().slice(0, MAX_SKU_LENGTH).replace(/-+$/g, '');
}

/** Corta a base para o sufixo caber dentro do tamanho maximo do SKU. */
function withSuffix(base: string, suffix: string): string {
  const room = MAX_SKU_LENGTH - suffix.length - 1;

  return `${base.slice(0, room).replace(/-+$/g, '')}-${suffix}`;
}
