import { lineKey, type CartLine, type CartLineHint, type CartQuote } from '@/features/cart';
import type { OrderItemView } from '@/features/checkout';

/**
 * "Pedir novamente", decidido por uma função pura.
 *
 * ## O pedido e um retrato, a cotação e o presente
 *
 * O pedido guarda nome, foto e preço congelados no instante em que fechou —
 * e assim que ele consegue ser um comprovante meses depois. Repetir o pedido
 * não e copiar esse retrato para a sacola: e perguntar ao catálogo de hoje
 * o que ainda existe. Um frasco que saiu de linha em marco não pode voltar
 * para a sacola em setembro só porque esta escrito num pedido antigo.
 *
 * Quem responde e `POST /cart/quote`, que já devolve exatamente isto por
 * linha: se vale, quanto ainda há em estoque e, quando não vale, **a frase
 * pronta** do motivo. Esta função não decide disponibilidade e não escreve
 * motivo nenhum — ela lê a resposta do servidor e separa em três montes.
 *
 * ## Por que são três montes, e não dois
 *
 * O enunciado obvio seria "o que da e o que não da". Mas há um caso no meio,
 * e ele e o mais comum de todos: o item continua a venda e sobraram **duas**
 * das três unidades que a pessoa levou da última vez.
 *
 * Esse item não saiu de linha. Joga-lo fora obrigaria a cliente a procurar o
 * perfume no catálogo e adicionar a mão o que já estava ali — e ela só
 * descobriria a falta conferindo a sacola item a item. Então ele entra, com
 * a quantidade que cabe, e a tela diz que ajustou.
 *
 * O sinal que separa "acabou" de "diminuiu" e estrutural, e não o texto do
 * motivo: uma linha indisponível **com estoque maior que zero** só pode ser
 * falta de quantidade — produto fora do catálogo e opção desativada chegam
 * sempre com `availableStock: 0`, porque nem variante existe para consultar.
 * Ler a frase para decidir seria amarrar esta função a redação do backend.
 *
 * ## O nome que aparece no aviso e o do pedido
 *
 * E não o da cotação. Produto excluído do catálogo volta com `productName`
 * vazio; o pedido, não — ele congelou o nome. "Asad Lattafa saiu do
 * catálogo" e um aviso útil; "Um item saiu do catálogo" manda a cliente
 * abrir o pedido para descobrir qual.
 */

/** Uma linha que vai para a sacola, com a dica que a gaveta desenha. */
export interface ReorderLine {
  line: CartLine;
  hint: CartLineHint;
  /** Quanto o pedido levava. Diferente de `line.quantity` no monte ajustado. */
  requested: number;
}

/** Um item que ficou de fora, com a frase que o servidor escreveu. */
export interface DroppedItem {
  name: string;
  /** "Este produto saiu do catálogo." Vem pronta da API. */
  reason: string;
}

export interface ReorderPlan {
  /** Entram com a quantidade do pedido original. */
  added: ReorderLine[];
  /** Entram com menos: sobrou estoque, mas não o bastante. */
  adjusted: ReorderLine[];
  /** Não entram. */
  dropped: DroppedItem[];
}

/** Nada entra na sacola: os três montes de itens úteis estão vazios. */
export function isEmptyPlan(plan: ReorderPlan): boolean {
  return plan.added.length === 0 && plan.adjusted.length === 0;
}

/** As linhas do pedido no formato que a cotação recebe. */
export function reorderItems(items: readonly OrderItemView[]): CartLine[] {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
  }));
}

export function planReorder(items: readonly OrderItemView[], quote: CartQuote): ReorderPlan {
  const quoted = new Map(
    quote.items.map((line) => [lineKey(line.productId, line.variantId), line]),
  );

  const plan: ReorderPlan = { added: [], adjusted: [], dropped: [] };

  for (const item of items) {
    const line = quoted.get(lineKey(item.productId, item.variantId));

    // Uma linha pedida que não voltou na cotação não deveria acontecer — o
    // servidor devolve todas, inclusive as indisponíveis. Se acontecer, o
    // item fica de fora com uma frase honesta em vez de entrar no escuro.
    if (line === undefined) {
      plan.dropped.push({
        name: item.productName,
        reason: 'Não foi possível conferir este item no catálogo.',
      });

      continue;
    }

    const hint: CartLineHint = {
      name: line.productName === '' ? item.productName : line.productName,
      slug: line.productSlug,
      variantLabel: line.variantLabel === '' ? item.variantLabel : line.variantLabel,
      image: line.image === '' ? item.image : line.image,
    };

    if (!line.unavailable) {
      plan.added.push({
        line: { productId: item.productId, variantId: item.variantId, quantity: item.quantity },
        hint,
        requested: item.quantity,
      });

      continue;
    }

    if (line.availableStock > 0) {
      plan.adjusted.push({
        line: {
          productId: item.productId,
          variantId: item.variantId,
          quantity: line.availableStock,
        },
        hint,
        requested: item.quantity,
      });

      continue;
    }

    plan.dropped.push({
      name: line.productName === '' ? item.productName : line.productName,
      reason: line.unavailableReason,
    });
  }

  return plan;
}
