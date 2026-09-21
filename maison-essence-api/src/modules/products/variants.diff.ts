/** O que o PATCH manda em cada posicao do array de variantes. */
export interface VariantInput {
  /** Ausente em variante nova: e assim que o painel diz "esta eu acabei de criar". */
  id?: string;
  sku?: string;
  label?: string;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stock?: number;
  image?: string;
  isActive?: boolean;
  allowBackorder?: boolean;
}

/**
 * O que fazer com cada variante depois de comparar a lista recebida com a
 * que esta gravada.
 *
 * `retire` e o caso que existe para proteger o historico: a variante saiu da
 * lista, mas algum pedido aponta para ela. Apagar o subdocumento quebraria a
 * devolucao de estoque do cancelamento, que procura a variante pelo
 * `items.variantId` do pedido — entao ela fica, desativada, fora da vitrine e
 * fora do painel de vendas.
 */
export type VariantPlan =
  | { action: 'update'; id: string; data: VariantInput }
  | { action: 'add'; data: VariantInput }
  | { action: 'retire'; id: string }
  | { action: 'drop'; id: string };

export interface VariantChanges {
  /** Na ordem em que o painel mandou; as aposentadas vao para o fim. */
  plans: VariantPlan[];
  /** Ids citados que nao sao deste produto. Quem chamou responde 422. */
  unknownIds: string[];
}

/**
 * Compara o array completo de variantes recebido com o que o produto tem.
 *
 * O painel manda a lista inteira a cada gravacao, e nao uma lista de
 * operacoes: e o array que a tela edita, e reconstruir o diff aqui evita que
 * o front tenha que rastrear o que mexeu. Variante com `id` conhecido e
 * atualizada no lugar, sem `id` e criada, e a que sumiu da lista sai — de
 * vez, se nunca foi vendida, ou apenas desativada, se ja foi.
 */
export function planVariants(
  incoming: readonly VariantInput[],
  existingIds: readonly string[],
  soldIds: ReadonlySet<string>,
): VariantChanges {
  const known = new Set(existingIds);
  const unknownIds: string[] = [];
  const mentioned = new Set<string>();
  const plans: VariantPlan[] = [];

  for (const data of incoming) {
    if (data.id === undefined) {
      plans.push({ action: 'add', data });
      continue;
    }

    if (!known.has(data.id)) {
      unknownIds.push(data.id);
      continue;
    }

    mentioned.add(data.id);
    plans.push({ action: 'update', id: data.id, data });
  }

  for (const id of existingIds) {
    if (mentioned.has(id)) {
      continue;
    }

    plans.push(soldIds.has(id) ? { action: 'retire', id } : { action: 'drop', id });
  }

  return { plans, unknownIds };
}
