import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  lineKey,
  type CartLine,
  type CartLineKey,
  type QuoteItem,
} from './cart.types';

/**
 * O estado da sacola, e so ele.
 *
 * Fica no cliente porque e do cliente: o backend nao tem coleccao de carrinho
 * — tem uma rota de cotacao que recebe as linhas e devolve os totais. Isso
 * torna a sacola instantanea (adicionar item nao espera rede) e faz dela a
 * unica parte do fluxo de compra que sobrevive sem conexao.
 *
 * Persistida em `localStorage`: quem monta a sacola no celular, fecha o
 * navegador e volta no dia seguinte encontra tudo no lugar.
 */

interface CartState {
  /** Na ordem em que foram adicionados. */
  lines: CartLine[];

  /**
   * Acrescenta, ou soma na linha que ja existe.
   *
   * Mesmo produto e mesma variante sao a mesma linha: duas linhas iguais
   * fariam o servidor devolver o aviso de itens somados, e o cliente veria a
   * sacola se reorganizar sozinha depois da cotacao.
   */
  addLine: (line: CartLine) => void;

  /** Quantidade exata. Zero ou menos remove a linha. */
  setQuantity: (productId: string, variantId: string, quantity: number) => void;

  removeLine: (productId: string, variantId: string) => void;

  /** Chamado quando o pedido e fechado. */
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      addLine: (line) => {
        set((state) => {
          const key = lineKey(line.productId, line.variantId);
          const existing = state.lines.find((item) => keyOf(item) === key);

          if (existing) {
            return {
              lines: state.lines.map((item) =>
                keyOf(item) === key
                  ? { ...item, quantity: capQuantity(item.quantity + line.quantity) }
                  : item,
              ),
            };
          }

          // O teto de linhas e o mesmo da cotacao: deixar entrar a linha 51
          // so adiaria a recusa para o momento de fechar o pedido.
          if (state.lines.length >= MAX_CART_LINES) {
            return state;
          }

          return { lines: [...state.lines, { ...line, quantity: capQuantity(line.quantity) }] };
        });
      },

      setQuantity: (productId, variantId, quantity) => {
        set((state) => {
          const key = lineKey(productId, variantId);

          if (quantity <= 0) {
            return { lines: state.lines.filter((item) => keyOf(item) !== key) };
          }

          return {
            lines: state.lines.map((item) =>
              keyOf(item) === key ? { ...item, quantity: capQuantity(quantity) } : item,
            ),
          };
        });
      },

      removeLine: (productId, variantId) => {
        set((state) => ({
          lines: state.lines.filter((item) => keyOf(item) !== lineKey(productId, variantId)),
        }));
      },

      clear: () => {
        set({ lines: [] });
      },
    }),
    {
      name: 'maison-essence.cart',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

/**
 * Os seletores.
 *
 * Funcoes soltas, e nao campos calculados no store: `useCart(cartItemCount)`
 * so re-renderiza o contador do header quando o numero muda, e nao a cada
 * mexida em qualquer linha.
 */

export function cartItemCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartIsEmpty(state: CartState): boolean {
  return state.lines.length === 0;
}

/**
 * O subtotal pelos precos guardados na sacola.
 *
 * Para o resumo lateral, e nada alem disso: nao inclui desconto progressivo,
 * frete nem desconto de PIX, e pode estar defasado. O valor que vale e o
 * `totalCents` da cotacao.
 */
export function cartSnapshotSubtotalCents(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0);
}

/** As linhas no formato que `POST /cart/quote` recebe. */
export function cartQuoteItems(state: CartState): QuoteItem[] {
  return state.lines.map(({ productId, variantId, quantity }) => ({
    productId,
    variantId,
    quantity,
  }));
}

function keyOf(line: CartLine): CartLineKey {
  return lineKey(line.productId, line.variantId);
}

function capQuantity(quantity: number): number {
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_LINE_QUANTITY);
}
