import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '@/lib/http';
import { createOrder, quoteConflictOf } from './orders.api';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from './checkout.types';
import {
  isConfirmableConflict,
  type CreateOrderInput,
  type CreatedOrder,
  type QuoteConflict,
} from './order.types';

/**
 * O envio do pedido, com as duas protecoes que este botao exige.
 *
 * ## O duplo clique
 *
 * E o jeito mais comum de gerar pedido duplicado, e nao por descuido: o
 * botao fica no fim de um formulario longo, a rede do celular demora, nada
 * acontece na tela por um segundo e a pessoa clica de novo. Dois pedidos
 * iguais chegam ao WhatsApp da dona, e alguem precisa descobrir qual
 * cancelar.
 *
 * A trava tem duas camadas, e as duas sao necessarias:
 *
 * 1. `isSubmitting` desabilita o botao. Resolve o caso visivel e avisa o
 *    cliente do que esta acontecendo.
 * 2. O `useRef` recusa a segunda chamada **no mesmo instante**. Dois cliques
 *    rapidos sao dois eventos separados, e o segundo pode chegar antes de o
 *    React ter redesenhado o botao com o estado novo — a bandeira em `ref`
 *    muda no mesmo quadro, sem esperar render nenhum, e e ela que fecha essa
 *    janela.
 *
 * Nenhuma das duas substitui o limite de cinco pedidos por dez minutos que o
 * servidor aplica por IP e por telefone. Elas evitam o duplicado honesto;
 * ele evita o resto.
 *
 * ## O 409
 *
 * O servidor refaz a cotacao inteira antes de gravar e compara com o total
 * que estava na tela. Divergiu, ele recusa e devolve a cotacao nova. Isso
 * nao e erro — e o sistema funcionando: o preco mudou, o desconto venceu ou
 * a ultima unidade acabou entre montar a sacola e apertar o botao.
 *
 * O conflito nao vira mensagem vermelha e nao reenvia nada sozinho. Ele
 * fica guardado aqui, a tela abre o modal comparando o valor antigo com o
 * novo, e nada acontece ate alguem decidir. Reenviar automaticamente com o
 * valor recalculado seria cobrar um preco que o cliente nao viu — que e
 * exatamente o que a conferencia do servidor existe para impedir.
 */

export interface CreateOrderView {
  /** Envia. A segunda chamada durante um envio e ignorada. */
  submit: (input: CreateOrderInput) => void;
  isSubmitting: boolean;
  /** O `409` aberto, esperando decisao. `null` quando nao ha. */
  conflict: QuoteConflict | null;
  /** Segue com o valor novo: reenvia o mesmo pedido com o total recalculado. */
  acceptConflict: () => void;
  /** Fecha o modal sem enviar nada. O pedido continua por fazer. */
  dismissConflict: () => void;
  /** A frase de um erro que nao e conflito de cotacao. */
  error: string | null;
}

export interface UseCreateOrderOptions {
  /** O pedido existe. E aqui que a sacola e esvaziada, e so aqui. */
  onSuccess: (order: CreatedOrder) => void;
}

export function useCreateOrder({ onSuccess }: UseCreateOrderOptions): CreateOrderView {
  const [conflict, setConflict] = useState<QuoteConflict | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * A bandeira do duplo clique.
   *
   * Em `ref`, e nao em estado: ela precisa valer no mesmo quadro do clique,
   * antes de qualquer render. Um `useState` aqui so mudaria o valor lido na
   * renderizacao seguinte — e a segunda chamada de um duplo clique acontece
   * antes dela.
   */
  const inFlight = useRef(false);

  /**
   * O ultimo corpo enviado, para o reenvio do conflito.
   *
   * Guardado aqui e nao no estado do conflito porque e a mesma coisa que foi
   * mandada, byte a byte: o reenvio troca `expectedTotalCents` e, quando e o
   * caso, o parcelamento — e nada mais. Remontar o corpo a partir da tela
   * abriria a chance de ele sair diferente do que produziu o total que o
   * cliente acabou de confirmar.
   */
  const lastInput = useRef<CreateOrderInput | null>(null);

  const mutation = useMutation<CreatedOrder, unknown, CreateOrderInput>({
    mutationFn: (input) => createOrder(input),

    onSuccess: (order) => {
      setConflict(null);
      setError(null);
      onSuccess(order);
    },

    onError: (failure) => {
      const mismatch = quoteConflictOf(failure);

      if (mismatch === null) {
        setError(errorMessage(failure));

        return;
      }

      // Conflito nao e erro na tela: e uma decisao esperando o cliente.
      setError(null);
      setConflict(mismatch);
    },

    onSettled: () => {
      inFlight.current = false;
    },
  });

  const send = useCallback(
    (input: CreateOrderInput) => {
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      lastInput.current = input;
      setError(null);

      mutation.mutate(input);
    },
    [mutation],
  );

  const acceptConflict = useCallback(() => {
    const pending = lastInput.current;

    if (conflict === null || pending === null || !isConfirmableConflict(conflict.reason)) {
      return;
    }

    setConflict(null);
    send(withRecalculatedTotal(pending, conflict));
  }, [conflict, send]);

  const dismissConflict = useCallback(() => {
    setConflict(null);
  }, []);

  return {
    submit: send,
    isSubmitting: mutation.isPending,
    conflict,
    acceptConflict,
    dismissConflict,
    error,
  };
}

/**
 * O mesmo pedido, agora com o valor que o servidor calculou.
 *
 * Duas trocas, e so duas. O total passa a ser o da cotacao nova — e o que o
 * cliente acabou de ver no modal e confirmar. O parcelamento acompanha
 * quando o conflito foi sobre ele: o servidor ja diz, em `quote.payment`,
 * em quantas vezes esse total cabe, e mandar de novo as 10x que ele acabou
 * de recusar so produziria o mesmo `409`.
 *
 * No PIX o parcelamento nao e tocado: ele nao existe ali.
 */
function withRecalculatedTotal(
  input: CreateOrderInput,
  conflict: QuoteConflict,
): CreateOrderInput {
  const method: PaymentMethod = input.payment.method;

  return {
    ...input,
    expectedTotalCents: conflict.quote.totalCents,
    payment:
      method === PAYMENT_METHODS.CARD
        ? { method, installments: conflict.quote.payment.installments }
        : { method },
  };
}
