import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDeliveryCity,
  deleteDeliveryCity,
  listDeliveryCities,
  reorderDeliveryCities,
  updateDeliveryCity,
} from './admin.api';
import { adminKeys } from './admin.keys';
import type {
  AdminDeliveryCity,
  CreateDeliveryCityInput,
  UpdateDeliveryCityInput,
} from './admin.types';

/**
 * As cidades atendidas.
 *
 * ## Cinco minutos de frescor
 *
 * A tabela de taxas muda quando o combustível sobe, e não durante o dia. Quem
 * a muda esta nesta tela e recebe a invalidação na hora.
 *
 * ## Nada aqui e otimista, exceto a ordem
 *
 * Taxa e prazo são dinheiro e promessa: a dona precisa **ver** que o valor
 * novo entrou, e não vê-lo aparecer e voltar meio segundo depois. A
 * reordenação e o caso oposto — o gesto e o arraste, e um item que volta ao
 * lugar enquanto o servidor responde faz duvidar de que o arraste funcionou.
 */
const STALE_TIME_MS = 5 * 60_000;

export function useDeliveryCities() {
  return useQuery({
    queryKey: adminKeys.deliveryCities(),
    queryFn: ({ signal }) => listDeliveryCities(signal),
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateDeliveryCity() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDeliveryCityInput) => createDeliveryCity(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.deliveryCities() });
    },
  });
}

/**
 * Salva uma linha da tabela.
 *
 * A resposta entra direto no cache, substituindo só a cidade alterada: uma
 * invalidação pediria a lista inteira de volta a cada campo salvo, e a dona
 * salva cinco campos seguidos quando esta reajustando as taxas.
 */
export function useUpdateDeliveryCity() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDeliveryCityInput }) =>
      updateDeliveryCity(id, input),

    onSuccess: (saved) => {
      client.setQueryData<AdminDeliveryCity[]>(adminKeys.deliveryCities(), (current) =>
        current?.map((city) => (city.id === saved.id ? saved : city)),
      );
    },
  });
}

/**
 * Regrava a ordem, com a lista já reposicionada na tela.
 *
 * A ordem daqui e a ordem do seletor de cidade no checkout — a cidade da loja
 * em primeiro, porque e a de quase todo pedido. O retrato anterior volta se a
 * chamada falhar.
 */
export function useReorderDeliveryCities() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (cities: readonly AdminDeliveryCity[]) =>
      reorderDeliveryCities(cities.map((city) => city.id)),

    onMutate: async (cities) => {
      await client.cancelQueries({ queryKey: adminKeys.deliveryCities() });

      const previous = client.getQueryData<AdminDeliveryCity[]>(adminKeys.deliveryCities());

      client.setQueryData<AdminDeliveryCity[]>(adminKeys.deliveryCities(), [...cities]);

      return { previous };
    },

    onError: (_error, _cities, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(adminKeys.deliveryCities(), context.previous);
      }
    },

    onSuccess: (reordered) => {
      client.setQueryData(adminKeys.deliveryCities(), reordered);
    },
  });
}

export function useDeleteDeliveryCity() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDeliveryCity(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.deliveryCities() });
    },
  });
}
