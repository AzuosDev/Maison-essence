import { lineKey, type CartLine, type CartLineHint, type CartQuote } from '@/features/cart';
import type { OrderItemView } from '@/features/checkout';

/**
 * "Pedir novamente", decidido por uma funcao pura.
 *
 * ## O pedido e um retrato, a cotacao e o presente
 *
 * O pedido guarda nome, foto e preco congelados no instante em que fechou —
 * e assim que ele consegue ser um comprovante meses depois. Repetir o pedido
 * nao e copiar esse retrato para a sacola: e perguntar ao catalogo de hoje
 * o que ainda existe. Um frasco que saiu de linha em marco nao pode voltar
 * para a sacola em setembro so porque esta escrito num pedido antigo.
 *
 * Quem responde e `POST /cart/quote`, que ja devolve exatamente isto por
 * linha: se vale, quanto ainda ha em estoque e, quando nao vale, **a frase
 * pronta** do motivo. Esta funcao nao decide disponibilidade e nao escreve
 * motivo nenhum — ela le a resposta do servidor e separa em tres montes.
 *
 * ## Por que sao tres montes, e nao dois
 *
 * O enunciado obvio seria "o que da e o que nao da". Mas ha um caso no meio,
 * e ele e o mais comum de todos: o item continua a venda e sobraram **duas**
 * das tres unidades que a pessoa levou da ultima vez.
 *
 * Esse item nao saiu de linha. Joga-lo fora obrigaria a cliente a procurar o
 * perfume no catalogo e adicionar a mao o que ja estava ali — e ela so
 * descobriria a falta conferindo a sacola item a item. Entao ele entra, com
 * a quantidade que cabe, e a tela diz que ajustou.
 *
 * O sinal que separa "acabou" de "diminuiu" e estrutural, e nao o texto do
 * motivo: uma linha indisponivel **com estoque maior que zero** so pode ser
 * falta de quantidade — produto fora do catalogo e opcao desativada chegam
 * sempre com `availableStock: 0`, porque nem variante existe para consultar.
 * Ler a frase para decidir seria amarrar esta funcao a redacao do backend.
 *
 * ## O nome que aparece no aviso e o do pedido
 *
 * E nao o da cotacao. Produto excluido do catalogo volta com `productName`
 * vazio; o pedido, nao — ele congelou o nome. "Asad Lattafa saiu do
 * catalogo" e um aviso util; "Um item saiu do catalogo" manda a cliente
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
  /** "Este produto saiu do catalogo." Vem pronta da API. */
  reason: string;
}

export interface ReorderPlan {
  /** Entram com a quantidade do pedido original. */
  added: ReorderLine[];
  /** Entram com menos: sobrou estoque, mas nao o bastante. */
  adjusted: ReorderLine[];
  /** Nao entram. */
  dropped: DroppedItem[];
}

/** Nada entra na sacola: os tres montes de itens uteis estao vazios. */
export function isEmptyPlan(plan: ReorderPlan): boolean {
  return plan.added.length === 0 && plan.adjusted.length === 0;
}

/** As linhas do pedido no formato que a cotacao recebe. */
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

    // Uma linha pedida que nao voltou na cotacao nao deveria acontecer — o
    // servidor devolve todas, inclusive as indisponiveis. Se acontecer, o
    // item fica de fora com uma frase honesta em vez de entrar no escuro.
    if (line === undefined) {
      plan.dropped.push({
        name: item.productName,
        reason: 'Não foi possível conferir este item no catalogo.',
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
