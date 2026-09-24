import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { createOrder, orderFailureOf, quoteConflictOf } from './orders.api';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from './checkout.types';
import {
  isConfirmableConflict,
  type CreateOrderInput,
  type CreatedOrder,
  type OrderFailure,
  type QuoteConflict,
} from './order.types';
import { reserveWhatsappTab, type WhatsappHandoff } from './whatsapp-handoff';

/**
 * O envio do pedido, com as duas proteções que este botão exige.
 *
 * ## O duplo clique
 *
 * E o jeito mais comum de gerar pedido duplicado, e não por descuido: o
 * botão fica no fim de um formulário longo, a rede do celular demora, nada
 * acontece na tela por um segundo e a pessoa clica de novo. Dois pedidos
 * iguais chegam ao WhatsApp da dona, e alguém precisa descobrir qual
 * cancelar.
 *
 * A trava tem duas camadas, e as duas são necessarias:
 *
 * 1. `isSubmitting` desabilita o botão. Resolve o caso visível e avisa o
 *    cliente do que esta acontecendo.
 * 2. O `useRef` recusa a segunda chamada **no mesmo instante**. Dois cliques
 *    rapidos são dois eventos separados, e o segundo pode chegar antes de o
 *    React ter redesenhado o botão com o estado novo — a bandeira em `ref`
 *    muda no mesmo quadro, sem esperar render nenhum, e e ela que fecha essa
 *    janela.
 *
 * Nenhuma das duas substitui o limite de cinco pedidos por dez minutos que o
 * servidor aplica por IP e por telefone. Elas evitam o duplicado honesto;
 * ele evita o resto.
 *
 * ## O 409
 *
 * O servidor refaz a cotação inteira antes de gravar e compara com o total
 * que estava na tela. Divergiu, ele recusa e devolve a cotação nova. Isso
 * não e erro — e o sistema funcionando: o preço mudou, o desconto venceu ou
 * a última unidade acabou entre montar a sacola e apertar o botão.
 *
 * O conflito não vira mensagem vermelha e não reenvia nada sozinho. Ele
 * fica guardado aqui, a tela abre o modal comparando o valor antigo com o
 * novo, e nada acontece até alguém decidir. Reenviar automaticamente com o
 * valor recalculado seria cobrar um preço que o cliente não viu — que e
 * exatamente o que a conferência do servidor existe para impedir.
 *
 * ## A aba do WhatsApp
 *
 * A reserva da aba mora aqui, e não na tela, por um motivo só: são três os
 * caminhos que criam um pedido — o envio, a confirmação do `409` e a
 * repetição depois de uma falha —, e os três saem de um clique. Se a reserva
 * ficasse na página, cada um deles precisaria lembrar de fazer a mesma
 * chamada, na mesma ordem, antes do mesmo `await`; o dia em que um esquecer,
 * o pedido e criado e a conversa não abre — e só no iPhone de alguém.
 *
 * Todos passam por `send`, e `send` reserva. Ver `whatsapp-handoff`.
 */

export interface CreateOrderView {
  /** Envia. A segunda chamada durante um envio e ignorada. */
  submit: (input: CreateOrderInput) => void;
  isSubmitting: boolean;
  /** O `409` aberto, esperando decisão. `null` quando não há. */
  conflict: QuoteConflict | null;
  /** Segue com o valor novo: reenvia o mesmo pedido com o total recalculado. */
  acceptConflict: () => void;
  /** Fecha o modal sem enviar nada. O pedido continua por fazer. */
  dismissConflict: () => void;
  /** O que deu errado, quando não foi conflito de cotação. */
  failure: OrderFailure | null;
  /**
   * Manda de novo o mesmo pedido, sem mudar nada.
   *
   * E a saída das falhas que não são do conteúdo do pedido — queda de rede,
   * servidor fora do ar. Reaproveita o corpo que já foi montado em vez de
   * mandar o cliente refazer as quatro etapas.
   */
  retry: () => void;
}

export interface UseCreateOrderOptions {
  /** O pedido existe. E aqui que a sacola e esvaziada, e só aqui. */
  onSuccess: (order: CreatedOrder) => void;
}

export function useCreateOrder({ onSuccess }: UseCreateOrderOptions): CreateOrderView {
  const [conflict, setConflict] = useState<QuoteConflict | null>(null);
  const [failure, setFailure] = useState<OrderFailure | null>(null);

  /**
   * A bandeira do duplo clique.
   *
   * Em `ref`, e não em estado: ela precisa valer no mesmo quadro do clique,
   * antes de qualquer render. Um `useState` aqui só mudaria o valor lido na
   * renderização seguinte — e a segunda chamada de um duplo clique acontece
   * antes dela.
   */
  const inFlight = useRef(false);

  /**
   * O último corpo enviado, para o reenvio do conflito.
   *
   * Guardado aqui e não no estado do conflito porque e a mesma coisa que foi
   * mandada, byte a byte: o reenvio troca `expectedTotalCents` e, quando e o
   * caso, o parcelamento — e nada mais. Remontar o corpo a partir da tela
   * abriria a chance de ele sair diferente do que produziu o total que o
   * cliente acabou de confirmar.
   */
  const lastInput = useRef<CreateOrderInput | null>(null);

  /**
   * A aba reservada no clique, esperando a resposta.
   *
   * Em `ref` pela mesma razão da bandeira acima: ela e aberta durante o
   * evento e usada quando a promessa resolve, sem nenhum render no meio.
   */
  const handoff = useRef<WhatsappHandoff | null>(null);

  const mutation = useMutation<CreatedOrder, unknown, CreateOrderInput>({
    mutationFn: (input) => createOrder(input),

    onSuccess: (order) => {
      setConflict(null);
      setFailure(null);

      // A conversa primeiro. A tela de confirmação que `onSuccess` abre e a
      // rede de segurança de quem teve a aba bloqueada — e ela precisa
      // aparecer com a passagem já tentada, e não antes dela.
      handoff.current?.send(order.whatsappUrl);
      handoff.current = null;

      onSuccess(order);
    },

    onError: (reason) => {
      // Nada foi criado: a aba reservada não tem para onde ir. Fechada aqui,
      // e não deixada em branco atrás da tela de erro.
      handoff.current?.release();
      handoff.current = null;

      const mismatch = quoteConflictOf(reason);

      if (mismatch === null) {
        setFailure(orderFailureOf(reason));

        return;
      }

      // Conflito não e erro na tela: e uma decisão esperando o cliente.
      setFailure(null);
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
      setFailure(null);

      // Antes do `mutate`, e não depois: a reserva só e permitida enquanto o
      // clique que a pediu ainda esta sendo tratado.
      handoff.current = reserveWhatsappTab();

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

  /**
   * De novo, igual.
   *
   * O mesmo corpo, sem remontar nada: o pedido que falhou por rede não tem
   * defeito nenhum, e recalcular a partir da tela abriria a chance de ele
   * sair diferente — inclusive com outro total, que o servidor recusaria.
   */
  const retry = useCallback(() => {
    const pending = lastInput.current;

    if (pending !== null) {
      send(pending);
    }
  }, [send]);

  return {
    submit: send,
    isSubmitting: mutation.isPending,
    conflict,
    acceptConflict,
    dismissConflict,
    failure,
    retry,
  };
}

/**
 * O mesmo pedido, agora com o valor que o servidor calculou.
 *
 * Duas trocas, e só duas. O total passa a ser o da cotação nova — e o que o
 * cliente acabou de ver no modal e confirmar. O parcelamento acompanha
 * quando o conflito foi sobre ele: o servidor já diz, em `quote.payment`,
 * em quantas vezes esse total cabe, e mandar de novo as 10x que ele acabou
 * de recusar só produziria o mesmo `409`.
 *
 * No PIX o parcelamento não e tocado: ele não existe ali.
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
