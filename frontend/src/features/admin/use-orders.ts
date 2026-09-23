import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOrder, listOrders, updateOrderNotes, updateOrderStatus } from './admin.api';
import { adminKeys, type AdminOrderListParams } from './admin.keys';
import type { AdminOrder, OrderStatus } from './admin.types';

/**
 * Os pedidos, do ponto de vista do painel.
 *
 * ## Meio minuto de frescor
 *
 * O painel fica aberto o dia inteiro numa aba enquanto a dona atende. Meio
 * minuto e curto o bastante para um pedido novo aparecer sozinho entre uma
 * conversa e outra, e longo o bastante para trocar de aba nao disparar uma
 * consulta a cada vez.
 *
 * ## Por que a invalidacao e sempre da familia inteira
 *
 * Mudar o status de um pedido desatualiza mais coisa do que parece: o
 * detalhe, a lista filtrada que esta atras dele, a lista **sem** filtro, a
 * contagem de "esperando contato" da abertura e o faturamento do mes — e
 * `useDashboard` monta as dele com `adminKeys.orderList(...)`, debaixo da
 * mesma raiz. Invalidar `adminKeys.orders()` alcanca as cinco; invalidar a
 * chave especifica deixaria quatro numeros errados na tela ao lado.
 */

/** Meio minuto. Ver a nota acima. */
const STALE_TIME_MS = 30_000;

export function useOrders(params: AdminOrderListParams) {
  return useQuery({
    queryKey: adminKeys.orderList(params),
    queryFn: ({ signal }) => listOrders(params, signal),
    staleTime: STALE_TIME_MS,

    // A lista antiga fica na tela enquanto a nova vem. Sem isto, cada letra
    // digitada na busca apaga os resultados e devolve o esqueleto — a tela
    // pisca mais do que informa.
    placeholderData: (previous) => previous,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: adminKeys.order(id),
    queryFn: ({ signal }) => fetchOrder(id, signal),
    staleTime: STALE_TIME_MS,
    enabled: id !== '',
  });
}

/**
 * Move o pedido de status, com o seletor virando na hora.
 *
 * O otimismo aqui e menos sobre velocidade e mais sobre confianca: a dona
 * marca "Confirmado" e volta para o WhatsApp no mesmo segundo. Se ela
 * precisar esperar o servidor para ver a mudanca, ela clica de novo.
 *
 * O que o servidor pode recusar e real e tem mensagem propria — cancelar um
 * pedido ja cancelado responde 409 —, e nesse caso o retrato guardado volta
 * ao lugar e quem chamou mostra o texto que veio de la.
 */
export function useSetOrderStatus() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      updateOrderStatus(id, status),

    onMutate: async ({ id, status }) => {
      // Cancela o que estiver voando: uma resposta em transito chegaria
      // depois e sobrescreveria o estado otimista com o status antigo.
      await client.cancelQueries({ queryKey: adminKeys.order(id) });

      const previous = client.getQueryData<AdminOrder>(adminKeys.order(id));

      client.setQueryData<AdminOrder>(adminKeys.order(id), (current) =>
        current === undefined ? current : { ...current, status },
      );

      return { previous };
    },

    onError: (_error, { id }, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(adminKeys.order(id), context.previous);
      }
    },

    // No sucesso e na falha: o servidor mexeu em mais do que o status — o
    // `updatedAt` mudou, e o cancelamento gravou `stockRestoredAt` e
    // devolveu unidades ao catalogo.
    onSettled: () => {
      void client.invalidateQueries({ queryKey: adminKeys.orders() });
      void client.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}

/**
 * A anotacao interna do pedido.
 *
 * Sem otimismo: a anotacao e salva por um botao, e nao por um interruptor.
 * Quem acabou de escrever tres linhas sobre o combinado com o cliente
 * precisa saber que elas chegaram — e um "salvando" de meio segundo diz
 * isso melhor do que um texto que aparece salvo e some depois.
 */
export function useSetOrderNotes() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updateOrderNotes(id, notes),

    onSuccess: (order) => {
      client.setQueryData(adminKeys.order(order.id), order);
    },
  });
}
