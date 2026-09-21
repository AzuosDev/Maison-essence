import type { AuditChanges } from '../audit/audit.types.js';
import type { ProductDocument } from './schemas/product.schema.js';

/** O preco de uma variante, no instante do retrato. */
interface VariantPrice {
  sku: string;
  priceCents: number;
  compareAtPriceCents: number | null;
}

/** Retrato dos precos de um produto, indexado pelo id da variante. */
export type PriceSnapshot = Record<string, VariantPrice>;

/**
 * Os precos do produto agora.
 *
 * Indexado pelo id da variante, e nao pelo SKU: o SKU tambem pode ser editado
 * no mesmo PATCH, e comparar por ele faria uma correcao de codigo parecer uma
 * variante nova e outra apagada. O SKU vai junto so como rotulo.
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
 * O que mudou de preco entre dois retratos.
 *
 * So variantes que existem dos dois lados entram. Variante criada nao e
 * mudanca de preco — e produto novo ganhando uma opcao, e o preco dela ja
 * nasce registrado na criacao; variante removida tambem nao, e some junto com
 * o preco que tinha. O que esta trilha responde e "quanto custava antes?", e
 * essa pergunta so existe quando havia um antes.
 *
 * A chave e `SKU.campo` porque e assim que quem le reconhece a variante: o id
 * nao diz nada para quem esta olhando a tela do produto.
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
