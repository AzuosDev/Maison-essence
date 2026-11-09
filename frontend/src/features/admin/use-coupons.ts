import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCoupon, deleteCoupon, fetchCoupon, listCoupons, updateCoupon } from './admin.api';
import { adminKeys } from './admin.keys';
import type { CreateCouponInput, UpdateCouponInput } from './admin.types';

/**
 * Os cupons do painel.
 *
 * ## Por que o frescor aqui e curto
 *
 * A lista de taxas de entrega aguenta cinco minutos porque ela muda quando o
 * combustível sobe. Esta muda **sozinha**: cada pedido fechado no cupom mexe
 * na régua de usos, e quem esta olhando a tela não e quem causou a mudança —
 * e a cliente, do outro lado, num sábado de campanha. Trinta segundos e o que
 * mantem "restam 3" verdadeiro sem transformar a tela num relógio.
 *
 * `refetchOnWindowFocus` entra pelo mesmo motivo: a dona volta a aba do painel
 * depois de atender no WhatsApp, e a primeira coisa que ela olha e quanto
 * sobrou.
 *
 * ## Nada e otimista
 *
 * Nem a criação, nem o desligamento, nem o teto. Cupom e dinheiro que sai da
 * loja, e a dona precisa **ver** que o que ela escreveu entrou — não ver
 * aparecer e voltar meio segundo depois. E a mesma escolha da tabela de taxas.
 *
 * ## Toda escrita invalida a família inteira
 *
 * Nunca a chave de um cupom só. Desligar uma campanha pode mudar qual delas a
 * home anuncia (ver `announcedCouponId`), e a resposta do servidor não conta
 * isso — quem conta e a lista toda, relida.
 */
const STALE_TIME_MS = 30_000;

export function useCoupons() {
  return useQuery({
    queryKey: adminKeys.coupons(),
    queryFn: ({ signal }) => listCoupons(signal),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Um cupom, para a tela de edição.
 *
 * `enabled` fica desligado sem id, que e o caso do cadastro novo: a mesma tela
 * atende os dois endereços, e um `GET /admin/coupons/` sem id só renderia 404
 * para a dona que clicou em "Criar cupom".
 */
export function useCoupon(id: string) {
  return useQuery({
    queryKey: adminKeys.coupon(id),
    queryFn: ({ signal }) => fetchCoupon(id, signal),
    enabled: id !== '',
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateCoupon() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCouponInput) => createCoupon(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.coupons() });
    },
  });
}

export function useUpdateCoupon() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCouponInput }) =>
      updateCoupon(id, input),

    onSuccess: (saved) => {
      // O detalhe recebe a resposta direto — e a verdade mais nova que existe
      // sobre este cupom. A lista e relida porque a mudança de um cupom muda a
      // leitura dos outros: quem ocupa a home, e quantas vagas sobraram.
      client.setQueryData(adminKeys.coupon(saved.id), saved);
      void client.invalidateQueries({ queryKey: adminKeys.coupons() });
    },
  });
}

export function useDeleteCoupon() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: (_void, id) => {
      client.removeQueries({ queryKey: adminKeys.coupon(id) });
      void client.invalidateQueries({ queryKey: adminKeys.coupons() });
    },
  });
}
