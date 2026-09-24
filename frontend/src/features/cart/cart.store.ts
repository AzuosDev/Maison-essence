import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mergeCartLines } from './cart-merge';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  lineKey,
  type CartLine,
  type CartLineHint,
  type CartLineKey,
  type QuoteItem,
} from './cart.types';

/**
 * O estado da sacola, e só ele.
 *
 * Fica no cliente porque e do cliente: o backend não tem coleção de carrinho
 * — tem uma rota de cotação que recebe as linhas e devolve os totais. Isso
 * torna a sacola instantanea (adicionar item não espera rede) e faz dela a
 * única parte do fluxo de compra que sobrevive sem conexão.
 *
 * ## O que atravessa o `localStorage`, e o que não atravessa
 *
 * Três campos por linha: produto, variante e quantidade. Isso e o que o
 * `partialize` deixa passar, e e por isso que ele esta escrito com os campos
 * nomeados um a um em vez de um `...state` com omissões — a lista e curta de
 * propósito, e acrescentar algo a ela exige escrever o campo aqui e
 * responder por que ele precisa sobreviver ao fechamento do navegador.
 *
 * Nome, foto e rótulo da opção ficam em `hints`, fora da persistência: a
 * gaveta abre cheia no clique e, depois de uma recarga, espera a cotação.
 * Preço não esta em lugar nenhum — nem persistido, nem em memória. A tela lê
 * o preço da cotação ou não mostra preço.
 */

interface CartState {
  /** Na ordem em que foram adicionados. */
  lines: CartLine[];

  /**
   * Nome, foto e opção de cada linha, por chave. Memória apenas.
   *
   * Um mapa, e não campos na linha, porque e exatamente isso que mantem a
   * linha persistida limpa: o que não esta dentro de `CartLine` não tem como
   * ser gravado por engano.
   */
  hints: Record<CartLineKey, CartLineHint>;

  /**
   * A gaveta da sacola esta aberta.
   *
   * Mora aqui, e não no componente, porque quem a abre esta em qualquer
   * lugar da loja — o card da vitrine, o seletor rápido, a página do
   * produto — e quem a desenha e o layout. Um estado no meio do caminho
   * exigiria um contexto só para isso.
   */
  drawerOpen: boolean;

  /**
   * Acrescenta, ou soma na linha que já existe.
   *
   * Mesmo produto e mesma variante são a mesma linha: duas linhas iguais
   * fariam o servidor devolver o aviso de itens somados, e o cliente veria a
   * sacola se reorganizar sozinha depois da cotação.
   */
  addLine: (line: CartLine, hint: CartLineHint) => void;

  /** Quantidade exata. Zero ou menos remove a linha. */
  setQuantity: (productId: string, variantId: string, quantity: number) => void;

  removeLine: (productId: string, variantId: string) => void;

  /** Chamado quando o pedido e fechado. */
  clear: () => void;

  /**
   * Junta uma sacola guardada a esta. Usada no login.
   *
   * A guardada entra como base: ela e a mais antiga, e fica em cima na
   * lista, com o que foi escolhido nesta visita logo abaixo.
   */
  mergeLines: (stashed: readonly CartLine[]) => void;

  openDrawer: () => void;
  closeDrawer: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hints: {},
      drawerOpen: false,

      addLine: (line, hint) => {
        set((state) => {
          const key = lineKey(line.productId, line.variantId);
          const existing = state.lines.find((item) => keyOf(item) === key);
          const hints = { ...state.hints, [key]: hint };

          if (existing) {
            return {
              hints,
              lines: state.lines.map((item) =>
                keyOf(item) === key
                  ? { ...item, quantity: capQuantity(item.quantity + line.quantity) }
                  : item,
              ),
            };
          }

          // O teto de linhas e o mesmo da cotação: deixar entrar a linha 51
          // só adiaria a recusa para o momento de fechar o pedido.
          if (state.lines.length >= MAX_CART_LINES) {
            return state;
          }

          return {
            hints,
            lines: [...state.lines, { ...line, quantity: capQuantity(line.quantity) }],
          };
        });
      },

      setQuantity: (productId, variantId, quantity) => {
        set((state) => {
          const key = lineKey(productId, variantId);

          if (quantity <= 0) {
            return dropLine(state, key);
          }

          return {
            lines: state.lines.map((item) =>
              keyOf(item) === key ? { ...item, quantity: capQuantity(quantity) } : item,
            ),
          };
        });
      },

      removeLine: (productId, variantId) => {
        set((state) => dropLine(state, lineKey(productId, variantId)));
      },

      clear: () => {
        set({ lines: [], hints: {} });
      },

      mergeLines: (stashed) => {
        set((state) => ({ lines: mergeCartLines(stashed, state.lines) }));
      },

      openDrawer: () => {
        set({ drawerOpen: true });
      },

      closeDrawer: () => {
        set({ drawerOpen: false });
      },
    }),
    {
      name: 'maison-essence.cart',
      storage: createJSONStorage(() => localStorage),

      /**
       * Versão 2: a sacola deixou de guardar preço.
       *
       * A versão 1 gravava nome, foto, `unitPriceCents` e `availableStock`
       * em cada linha. Quem tem uma sacola dessas no navegador não pode
       * perde-lá por causa de uma mudanca de formato — e também não pode
       * continuar com o preço de semanas atrás encostado no item. A migração
       * resolve os dois: mantem as linhas, joga fora todo o resto.
       */
      version: 2,

      migrate: (persisted): { lines: CartLine[] } => {
        const saved = persisted as { lines?: unknown } | undefined;

        return { lines: onlyLineFields(saved?.lines) };
      },

      // Os três campos, escritos um a um. Ver a nota no topo do arquivo.
      partialize: (state) => ({
        lines: state.lines.map(({ productId, variantId, quantity }) => ({
          productId,
          variantId,
          quantity,
        })),
      }),
    },
  ),
);

/**
 * Os seletores.
 *
 * Funções soltas, e não campos calculados no store: `useCart(cartItemCount)`
 * só re-renderiza o contador do header quando o número muda, e não a cada
 * mexida em qualquer linha.
 */

export function cartItemCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartIsEmpty(state: CartState): boolean {
  return state.lines.length === 0;
}

/**
 * As linhas no formato que `POST /cart/quote` recebe.
 *
 * E a própria lista de linhas: a sacola persistida já tem exatamente o
 * formato do corpo da cotação, e não há tradução a fazer.
 */
export function cartQuoteItems(state: CartState): QuoteItem[] {
  return state.lines;
}

/** O que se sabe de uma linha antes da cotação. `null` depois de recarregar. */
export function cartHint(state: CartState, key: CartLineKey): CartLineHint | null {
  return state.hints[key] ?? null;
}

/* ---- Auxiliares --------------------------------------------------------- */

function dropLine(state: CartState, key: CartLineKey): Pick<CartState, 'lines' | 'hints'> {
  const { [key]: _removed, ...hints } = state.hints;

  return { lines: state.lines.filter((item) => keyOf(item) !== key), hints };
}

function keyOf(line: CartLine): CartLineKey {
  return lineKey(line.productId, line.variantId);
}

function capQuantity(quantity: number): number {
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_LINE_QUANTITY);
}

/** Linhas de uma versão anterior, reduzidas aos três campos que ficam. */
function onlyLineFields(value: unknown): CartLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): CartLine[] => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }

    const { productId, variantId, quantity } = entry as Record<string, unknown>;

    return typeof productId === 'string' &&
      typeof variantId === 'string' &&
      typeof quantity === 'number'
      ? [{ productId, variantId, quantity: capQuantity(quantity) }]
      : [];
  });
}
