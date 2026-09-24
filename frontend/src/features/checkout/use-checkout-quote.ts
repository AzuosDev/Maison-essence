import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  QUOTE_DEBOUNCE_MS,
  cartQuoteItems,
  fetchCartQuote,
  useCart,
  usePriceNotice,
  type CartQuote,
  type QuoteLine,
} from '@/features/cart';
import { useDeliveryCities } from '@/features/delivery';
import { useStoreSettings } from '@/features/settings';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { checkoutKeys, type QuoteInput } from './checkout.keys';
import { useCheckout } from './checkout.store';
import { FULFILLMENT_MODES, PAYMENT_METHODS } from './checkout.types';

/**
 * Quanto custa este pedido — perguntado ao servidor a cada escolha.
 *
 * E o requisito número um do checkout, e esta inteiro na forma da chave:
 * `checkoutKeys.quote(input)` carrega o corpo da cotação, então trocar a
 * cidade, alternar entre entrega e retirada, mudar para PIX ou escolher 6x
 * produz uma chave nova — e uma chave nova e uma consulta nova. Não há
 * `useEffect` observando campo para disparar recálculo, não há botão de
 * "atualizar total", e não há uma única multiplicação de preço por
 * quantidade nesta tela. O valor que o cliente lê e o que o servidor
 * respondeu para exatamente estas escolhas.
 *
 * ## O atraso de 400ms, e onde ele não se aplica
 *
 * Só os **itens** passam pelo atraso, e pela razão de sempre: quem aperta o
 * "+" quatro vezes quer seis unidades, e não quatro cotações.
 *
 * Entrega, cidade e pagamento entram na chave sem atraso nenhum. São cliques
 * únicos e deliberados — ninguém troca de cidade três vezes por segundo —, e
 * o critério de aceite e explicito: trocar a cidade muda a taxa e o total na
 * hora. Meio segundo de espera ali seria lido como a tela não ter entendido
 * o clique.
 *
 * ## A cotação antes de o cliente ter escolhido
 *
 * A etapa 1 mostra o subtotal, e o subtotal não depende de entrega nenhuma.
 * Mas `POST /cart/quote` exige um modo — a rota serve também ao pedido, onde
 * a taxa e parte da conta —, então até a etapa 2 a cotação sai com o modo
 * que a loja aceita hoje: retirada, se estiver ligada, ou a primeira cidade
 * atendida. E o mesmo arranjo da sacola, e com a mesma consequência — a taxa
 * que volta não pertence a escolha de ninguém.
 *
 * Por isso existe `totalsResolved`. Enquanto ele e `false`, o resumo mostra
 * o subtotal e escreve "a calcular" na linha do frete, em vez de anunciar um
 * total que inclui a taxa de uma cidade que o cliente não escolheu. Quando
 * ele vira `true`, o `totalCents` da resposta passa a ser o total da tela.
 *
 * O pagamento tem o mesmo tratamento por outro caminho: enquanto não há
 * escolha, a cotação vai como cartão a vista, que e a forma que **não mexe
 * no valor**. O PIX só desconta, e o parcelamento com juros só acrescenta;
 * começar pelo cartão a vista e começar pelo número que não vai encolher
 * sozinho depois.
 */

export interface CheckoutQuoteView {
  quote: CartQuote | undefined;
  /** As linhas que entram no total. */
  available: QuoteLine[];
  /** As que saíram: produto desativado, opção encerrada, estoque insuficiente. */
  unavailable: QuoteLine[];
  /** A primeira cotação ainda não respondeu: não há número nenhum em tela. */
  isPending: boolean;
  /** Há uma cotação no ar. Os números em tela são os anteriores. */
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  /**
   * A taxa e o total desta resposta pertencem a escolha do cliente.
   *
   * `false` enquanto ele não escolheu entrega ou retirada — e, na entrega,
   * enquanto não escolheu a cidade.
   */
  totalsResolved: boolean;
  /**
   * O corpo que produziu esta cotação.
   *
   * E o mesmo que vai dentro de `POST /orders`: o pedido e feito das
   * escolhas que geraram o total que o cliente viu, e não de uma segunda
   * montagem que poderia divergir dela em um campo.
   */
  input: QuoteInput | null;
  /**
   * Algum preço mudou desde a última visita.
   *
   * O mesmo aviso da sacola, pelo mesmo motivo e com a mesma comparação por
   * impressão digital: quem chega aqui pelo "Comprar agora" não passou pela
   * sacola, e lembra do número antigo.
   */
  pricesChanged: boolean;
  dismissPriceNotice: () => void;
}

export function useCheckoutQuote(): CheckoutQuoteView {
  const lines = useCart(cartQuoteItems);
  const settled = useDebouncedValue(lines, QUOTE_DEBOUNCE_MS);

  const { fulfillment, totalsResolved } = useQuoteFulfillment();
  const payment = useQuotePayment();

  const input = useMemo<QuoteInput | null>(
    () =>
      settled.length === 0 || fulfillment === null ? null : { items: settled, fulfillment, payment },
    [settled, fulfillment, payment],
  );

  const query = useQuery<CartQuote>({
    // O `input` nulo nunca chega a ser chave: a consulta esta desligada.
    queryKey: checkoutKeys.quote(input ?? EMPTY_INPUT),
    queryFn: ({ signal }) => fetchCartQuote(input ?? EMPTY_INPUT, signal),
    enabled: input !== null,

    // Cotação não se serve de cache. Zero não significa pedir a cada render —
    // significa que toda montagem e toda mudanca de escolha refazem a conta.
    staleTime: 0,

    // Os valores anteriores ficam na tela, esmaecidos, enquanto os novos vem.
    // Sem isto o resumo inteiro sumiria e voltaria a cada troca de cidade.
    placeholderData: (previous) => previous,
  });

  const { available, unavailable } = useMemo(() => split(query.data?.items ?? []), [query.data]);
  const priceNotice = usePriceNotice(query.data);

  return {
    quote: query.data,
    available,
    unavailable,
    isPending: query.isPending && input !== null,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
    totalsResolved,
    input,
    ...priceNotice,
  };
}

/* ---- A entrega que entra na cotação -------------------------------------- */

interface ResolvedFulfillment {
  fulfillment: QuoteInput['fulfillment'] | null;
  totalsResolved: boolean;
}

/**
 * O modo que vai no corpo, e se ele e mesmo o do cliente.
 *
 * Três casos, e o terceiro e o que exige cuidado:
 *
 * 1. **Retirada escolhida.** Vai retirada, taxa zero, e o total e o dele.
 * 2. **Entrega com cidade.** Vai a cidade, e o total e o dele.
 * 3. **Nada escolhido ainda** — ou entrega sem cidade. Vai o que a loja
 *    aceita hoje, só para a rota poder responder o subtotal, e
 *    `totalsResolved` fica `false`: a taxa que voltar não e de ninguém.
 *
 * `null` quando a loja não tem nem retirada ligada nem cidade cadastrada. A
 * consulta fica desligada e a tela mostra os itens sem total — o único
 * desenho honesto, porque não há como essa loja fechar um pedido, e inventar
 * um número no navegador seria o começo do problema que este módulo existe
 * para evitar.
 */
function useQuoteFulfillment(): ResolvedFulfillment {
  const mode = useCheckout((state) => state.mode);
  const cityId = useCheckout((state) => state.cityId);

  const { settings } = useStoreSettings();
  const { data: cities } = useDeliveryCities();

  const pickupEnabled = settings?.pickupEnabled === true;
  const firstCityId = cities?.[0]?.id ?? null;

  return useMemo(() => {
    if (mode === FULFILLMENT_MODES.PICKUP) {
      return { fulfillment: { mode }, totalsResolved: true };
    }

    if (mode === FULFILLMENT_MODES.DELIVERY && cityId !== '') {
      return { fulfillment: { mode, cityId }, totalsResolved: true };
    }

    if (pickupEnabled) {
      return { fulfillment: { mode: FULFILLMENT_MODES.PICKUP }, totalsResolved: false };
    }

    return {
      fulfillment:
        firstCityId === null
          ? null
          : { mode: FULFILLMENT_MODES.DELIVERY, cityId: firstCityId },
      totalsResolved: false,
    };
  }, [mode, cityId, pickupEnabled, firstCityId]);
}

/**
 * A forma de pagamento que entra no corpo.
 *
 * Sem escolha, cartão a vista: a forma que não mexe no valor. O
 * parcelamento só acompanha o cartão — no PIX ele não significa nada, e
 * manda-lo faria a tela e o servidor discordarem sobre o que foi pedido.
 */
function useQuotePayment(): QuoteInput['payment'] {
  const method = useCheckout((state) => state.method);
  const installments = useCheckout((state) => state.installments);

  return useMemo(
    () =>
      method === PAYMENT_METHODS.PIX
        ? { method }
        : { method: PAYMENT_METHODS.CARD, installments },
    [method, installments],
  );
}

/* ---- Auxiliares ----------------------------------------------------------- */

/** A sacola vazia nunca e cotada; este corpo só existe para o tipo fechar. */
const EMPTY_INPUT: QuoteInput = {
  items: [],
  fulfillment: { mode: FULFILLMENT_MODES.PICKUP },
  payment: { method: PAYMENT_METHODS.CARD, installments: 1 },
};

function split(items: readonly QuoteLine[]): { available: QuoteLine[]; unavailable: QuoteLine[] } {
  return {
    available: items.filter((item) => !item.unavailable),
    unavailable: items.filter((item) => item.unavailable),
  };
}
