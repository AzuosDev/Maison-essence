import type { AuditChanges } from '../audit/audit.types.js';
import type { ProductDocument } from './schemas/product.schema.js';

/** O preço de uma variante, no instante do retrato. */
interface VariantPrice {
  sku: string;
  priceCents: number;
  compareAtPriceCents: number | null;
}

/** Retrato dos preços de um produto, indexado pelo id da variante. */
export type PriceSnapshot = Record<string, VariantPrice>;

/**
 * Os preços do produto agora.
 *
 * Indexado pelo id da variante, e não pelo SKU: o SKU também pode ser editado
 * no mesmo PATCH, e comparar por ele faria uma correção de código parecer uma
 * variante nova e outra apagada. O SKU vai junto só como rótulo.
 */
export function priceSnapshotOf(product: ProductDocument): PriceSnapshot {
  return Object.fromEntries(
    product.variants.map((variant) => [
      variant.id,
      {
        sku: variant.sku,
        priceCents: variant.priceCents,
        compareAtPriceCents: variant.compareAtPriceCents,
      },
    ]),
  );
}

/**
 * O que mudou de preço entre dois retratos.
 *
 * Só variantes que existem dos dois lados entram. Variante criada não e
 * mudanca de preço — e produto novo ganhando uma opção, e o preço dela já
 * nasce registrado na criação; variante removida também não, e some junto com
 * o preço que tinha. O que esta trilha responde e "quanto custava antes?", e
 * essa pergunta só existe quando havia um antes.
 *
 * A chave e `SKU.campo` porque e assim que quem lê reconhece a variante: o id
 * não diz nada para quem esta olhando a tela do produto.
 */
export function priceChangesBetween(before: PriceSnapshot, after: PriceSnapshot): AuditChanges {
  const changes: AuditChanges = {};

  for (const [id, now] of Object.entries(after)) {
    const then = before[id];

    if (then === undefined) {
      continue;
    }

    if (then.priceCents !== now.priceCents) {
      changes[`${now.sku}.priceCents`] = { from: then.priceCents, to: now.priceCents };
    }

    if (then.compareAtPriceCents !== now.compareAtPriceCents) {
      changes[`${now.sku}.compareAtPriceCents`] = {
        from: then.compareAtPriceCents,
        to: now.compareAtPriceCents,
      };
    }
  }

  return changes;
}
