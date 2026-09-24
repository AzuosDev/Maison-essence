import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui';
import { fetchCartQuote, useCart } from '@/features/cart';
import type { OrderItemView } from '@/features/checkout';
import { isEmptyPlan, planReorder, reorderItems, type ReorderPlan } from './reorder';

/**
 * "Pedir novamente", do clique a gaveta aberta.
 *
 * ## Uma cotação antes de qualquer coisa
 *
 * O pedido guarda um retrato do catálogo de meses atrás. Antes de por
 * qualquer linha na sacola, este hook pergunta ao servidor o que ainda vale
 * — e só então decide, em `planReorder`, o que entra inteiro, o que entra
 * com menos e o que não entra.
 *
 * A alternativa seria copiar as linhas direto e deixar a sacola descobrir
 * sozinha na próxima cotação. Funcionaria, e seria pior de duas maneiras: a
 * gaveta abriria com itens que somem um segundo depois, e o aviso de "saiu
 * de linha" apareceria no carrinho, longe do pedido, sem dizer que veio
 * dali.
 *
 * ## Por que a cotação vai como retirada e PIX
 *
 * Porque o que se pergunta aqui e sobre **item**, não sobre entrega nem
 * sobre pagamento: quais linhas ainda existem e quanto resta de cada uma.
 * Retirada e a única combinação que não exige cidade — pedir `DELIVERY`
 * obrigaria a escolher uma cidade que ninguém escolheu ainda, só para
 * receber de volta a mesma lista de linhas. Os totais desta resposta são
 * descartados; quem recalcula o preço de verdade e a sacola, depois, com a
 * entrega que a pessoa escolher.
 *
 * ## O plano fica na tela, o aviso não passa voando
 *
 * O `toast` confirma o que entrou, e some. O que **não** entrou volta em
 * `plan` e a tela desenha na página, onde continua legível depois que o
 * aviso sumir: quem repete um pedido de três frascos e leva dois precisa
 * poder reler qual foi o terceiro.
 */
export function useReorder() {
  const addLine = useCart((state) => state.addLine);
  const openDrawer = useCart((state) => state.openDrawer);
  const { toast } = useToast();

  const [plan, setPlan] = useState<ReorderPlan | null>(null);

  const mutation = useMutation({
    mutationFn: async (items: readonly OrderItemView[]): Promise<ReorderPlan> => {
      const quote = await fetchCartQuote({
        items: reorderItems(items),
        fulfillment: { mode: 'pickup' },
        payment: { method: 'pix' },
      });

      return planReorder(items, quote);
    },

    onSuccess: (result) => {
      setPlan(result);

      for (const entry of [...result.added, ...result.adjusted]) {
        addLine(entry.line, entry.hint);
      }

      if (isEmptyPlan(result)) {
        // Nenhuma linha sobreviveu. Abrir a gaveta mostraria a sacola como
        // ela já estava, o que leria como "não aconteceu nada" — e alguma
        // coisa aconteceu: o pedido inteiro saiu do catálogo.
        toast({
          title: 'Nada deste pedido esta a venda agora',
          description: 'Os itens saíram do catálogo. Veja o que há de parecido na loja.',
          variant: 'danger',
          duration: 8000,
        });

        return;
      }

      openDrawer();

      toast({
        title: 'Itens na sacola',
        description: describeOutcome(result),
        variant: 'success',
      });
    },
  });

  const { mutate } = mutation;

  const reorder = useCallback(
    (items: readonly OrderItemView[]) => {
      setPlan(null);
      mutate(items);
    },
    [mutate],
  );

  const dismiss = useCallback(() => {
    setPlan(null);
  }, []);

  return {
    reorder,
    dismiss,
    plan,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/** A segunda linha do aviso: quantos entraram e se algo ficou de fora. */
function describeOutcome(plan: ReorderPlan): string {
  const total = plan.added.length + plan.adjusted.length;
  const entered = `${total} ${total === 1 ? 'item entrou' : 'itens entraram'} na sacola`;

  if (plan.dropped.length === 0 && plan.adjusted.length === 0) {
    return `${entered}.`;
  }

  return `${entered}. Veja abaixo o que mudou desde aquele pedido.`;
}
