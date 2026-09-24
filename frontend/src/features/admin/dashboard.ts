import {
  SOLD_ORDER_STATUSES,
  type AdminOrderSummary,
  type AdminProduct,
  type AdminVariant,
} from './admin.types';

/**
 * As contas da abertura do painel.
 *
 * **A API não tem rota de metricas.** Não existe `/admin/stats`, não existe
 * faturamento pronto, não existe contagem de estoque baixo. O que existe são
 * as listagens — pedidos e produtos —, e estes números saem delas, somados
 * aqui.
 *
 * O custo e honesto e vale registrar: as listagens vem paginadas em cem
 * itens, e uma loja que passar de cem pedidos no mês vai somar só a primeira
 * página. Por isso `revenueOf` devolve `truncated` junto do valor, e a tela
 * diz quando o número e um piso em vez de um total. A troca por uma rota de
 * agregação no backend apaga este arquivo inteiro e melhora a conta.
 *
 * Funções puras, sem React e sem rede: são elas que os testes conferem, e e
 * onde um erro de fuso ou um status somado a mais apareceria.
 */

/* ---- Recortes de tempo -------------------------------------------------- */

/**
 * A meia-noite de hoje, no fuso de quem esta olhando.
 *
 * O `Date` do navegador já esta no fuso local, e a API compara com o
 * `createdAt` gravado em UTC — a conversão acontece no `toISOString()`. Isso
 * importa numa loja do Cariri: as onze da noite de terca em Juazeiro são duas
 * da manha de quarta em UTC, e uma conta feita em UTC contaria o pedido das
 * 23h como "de amanha".
 */
export function startOfToday(now: Date = new Date()): string {
  const midnight = new Date(now);

  midnight.setHours(0, 0, 0, 0);

  return midnight.toISOString();
}

/** O primeiro instante do mês corrente, também no fuso local. */
export function startOfMonth(now: Date = new Date()): string {
  const first = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  return first.toISOString();
}

/* ---- Pedidos ------------------------------------------------------------ */

/** Quantos pedidos entraram desde a meia-noite. */
export function countSince(orders: readonly AdminOrderSummary[], sinceIso: string): number {
  return orders.filter((order) => order.createdAt >= sinceIso).length;
}

export interface Revenue {
  cents: number;
  /**
   * A soma parou na primeira página.
   *
   * O número continua verdadeiro como piso — e menor ou igual ao real —, e a
   * tela precisa dizer isso em vez de apresentar um total que não e total.
   */
  truncated: boolean;
}

/**
 * O faturamento de um conjunto de pedidos.
 *
 * Só os status de venda fechada entram. `PENDING_CONTACT` ficaria de fora
 * ainda que fosse a maioria: e o pedido que o cliente montou e que ainda não
 * virou conversa, e contar isso como faturamento faria a dona planejar com um
 * número que evapora.
 */
export function revenueOf(orders: readonly AdminOrderSummary[], truncated = false): Revenue {
  const cents = orders
    .filter((order) => SOLD_ORDER_STATUSES.includes(order.status))
    .reduce((total, order) => total + order.totalCents, 0);

  return { cents, truncated };
}

/* ---- Estoque ------------------------------------------------------------ */

/** Abaixo disto, a tela avisa. O mesmo número que a loja usa no "últimas unidades". */
export const LOW_STOCK_THRESHOLD = 3;

/**
 * Os produtos sem nenhuma unidade a venda.
 *
 * `inStock` já vem calculado pelo backend e considera a venda sob encomenda:
 * um produto que a dona vende por encomenda não aparece aqui, porque ele não
 * esta esgotado — esta a venda sem estoque em mãos, que e outra coisa.
 */
export function outOfStock(products: readonly AdminProduct[]): AdminProduct[] {
  return products.filter((product) => product.isActive && !product.inStock);
}

export interface LowStockLine {
  product: AdminProduct;
  variant: AdminVariant;
}

/**
 * As variantes que estão acabando, da mais urgente para a menos.
 *
 * Por **variante**, e não por produto: "Asad esta acabando" não diz o que
 * comprar, e o que a dona precisa saber e que restam duas unidades do de
 * 100ml enquanto o de 50ml esta cheio.
 *
 * Variante desativada ou sob encomenda fica de fora: nenhuma das duas tem
 * estoque a repor.
 */
export function lowStock(
  products: readonly AdminProduct[],
  threshold = LOW_STOCK_THRESHOLD,
): LowStockLine[] {
  const lines: LowStockLine[] = [];

  for (const product of products) {
    if (!product.isActive) {
      continue;
    }

    for (const variant of product.variants) {
      if (
        variant.isActive &&
        !variant.allowBackorder &&
        variant.stock > 0 &&
        variant.stock <= threshold
      ) {
        lines.push({ product, variant });
      }
    }
  }

  // `toSorted` em vez de `sort`: a lista acabou de ser montada aqui, mas o
  // habito de não mutar no retorno e o que evita um dia ordenar o array de
  // outra pessoa sem querer.
  return lines.toSorted((a, b) => a.variant.stock - b.variant.stock);
}
