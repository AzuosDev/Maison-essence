import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { checkoutKeys, type QuoteInput } from '@/features/checkout';
import { useDeliveryCities } from '@/features/delivery';
import { useStoreSettings } from '@/features/settings';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cartQuoteItems, useCart } from './cart.store';
import { pricesChangedSince, readPriceSnapshot, writePriceSnapshot } from './price-watch';
import { fetchCartQuote } from './quote.api';
import type { CartQuote, QuoteLine } from './quote.types';

/**
 * Quanto custa a sacola — perguntado ao servidor, sempre.
 *
 * Nenhuma tela do carrinho multiplica quantidade por preco. O subtotal, o
 * desconto por quantidade e o total saem daqui, e daqui saem calculados
 * contra o catalogo de agora: o preco que a dona mudou ontem, o produto que
 * ela desativou hoje e o estoque que acabou ha dez minutos entram na conta
 * sem que o navegador precise saber de nada disso.
 *
 * ## O atraso de 400ms
 *
 * Quem aperta o "+" quatro vezes seguidas quer seis unidades, e nao quatro
 * cotacoes. O atraso junta a rajada em uma consulta so, e o numero antigo
 * fica na tela — esmaecido — ate o novo chegar, em vez de a coluna de
 * valores piscar vazia a cada clique.
 *
 * A primeira cotacao nao espera: `useDebouncedValue` comeca com o valor que
 * recebeu, entao abrir a sacola dispara a consulta no mesmo quadro. O atraso
 * so existe para as mudancas seguintes, que sao as unicas que se acumulam.
 *
 * ## A entrega, que a sacola nao escolhe
 *
 * O resumo diz "frete a calcular", e diz a verdade: a cidade e escolhida no
 * fechamento do pedido, e o total que a sacola mostra e o dos produtos.
 *
 * Mas `POST /cart/quote` exige um modo de entrega — a rota serve tambem ao
 * checkout, onde a taxa e parte da conta —, e os dois modos tem exigencia
 * propria: a retirada precisa estar ligada no painel, e a entrega precisa de
 * uma cidade atendida. `fulfillmentFor` escolhe o que a loja aceita hoje; a
 * taxa que voltar e simplesmente ignorada pela tela, que exibe o
 * `subtotalCents` como total. Nenhuma conta e refeita no navegador para
 * isso: e outro campo da mesma resposta.
 *
 * O pagamento vai como cartao a vista pelo mesmo motivo — e a forma que nao
 * mexe no valor. O PIX desconta um percentual, e esse desconto pertence a
 * tela que o oferece, nao a sacola.
 */

/** O atraso entre a ultima mexida e a cotacao. */
export const QUOTE_DEBOUNCE_MS = 400;

export interface CartQuoteView {
  quote: CartQuote | undefined;
  /** As linhas que entram no total. */
  available: QuoteLine[];
  /** As que sairam: produto desativado, opcao encerrada, estoque insuficiente. */
  unavailable: QuoteLine[];
  /** A primeira cotacao ainda nao respondeu: nao ha numero nenhum em tela. */
  isPending: boolean;
  /** Ha uma cotacao no ar. Os numeros em tela sao os anteriores. */
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  /**
   * Algum preco mudou desde a ultima visita.
   *
   * Comparado por impressao digital, sem guardar valor — ver `price-watch`.
   */
  pricesChanged: boolean;
  dismissPriceNotice: () => void;
}

export function useCartQuote(): CartQuoteView {
  const lines = useCart(cartQuoteItems);
  const settled = useDebouncedValue(lines, QUOTE_DEBOUNCE_MS);

  const fulfillment = useQuoteFulfillment();

  const input = useMemo<QuoteInput | null>(
    () =>
      settled.length === 0 || fulfillment === null
        ? null
        : { items: settled, fulfillment, payment: { method: 'CARD', installments: 1 } },
    [settled, fulfillment],
  );

  const query = useQuery<CartQuote>({
    // O `input` nulo nunca chega a ser chave: a consulta esta desligada.
    queryKey: checkoutKeys.quote(input ?? EMPTY_INPUT),
    queryFn: ({ signal }) => fetchCartQuote(input ?? EMPTY_INPUT, signal),
    enabled: input !== null,

    // Cotacao nao se serve de cache: o preco de um minuto atras e um preco
    // que pode ja nao existir. Zero aqui nao significa pedir a cada render —
    // significa que toda montagem e toda mudanca de chave refazem a conta.
    staleTime: 0,

    // Os valores anteriores ficam na tela enquanto os novos vem. Sem isto, o
    // resumo inteiro sumiria e voltaria a cada clique no "+".
    placeholderData: (previous) => previous,
  });

  const quote = query.data;
  const pricesChanged = usePriceNotice(quote);

  const { available, unavailable } = useMemo(() => split(quote?.items ?? []), [quote]);

  return {
    quote,
    available,
    unavailable,
    isPending: query.isPending && input !== null,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
    ...pricesChanged,
  };
}

/* ---- A entrega que a cotacao exige -------------------------------------- */

/**
 * O modo de entrega que a loja aceita hoje.
 *
 * Retirada primeiro: nao depende de cidade nenhuma e a taxa e zero, que e
 * exatamente o que a sacola quer de um campo que ela nao vai mostrar. Sem
 * retirada, vale a primeira cidade atendida — qualquer uma serve, porque a
 * taxa que ela produz nao entra na tela.
 *
 * `null` quando a loja nao tem nem retirada nem cidade cadastrada. A
 * cotacao fica desligada e a sacola mostra os itens sem totais, que e o
 * unico desenho honesto: nao ha como essa loja fechar um pedido, e inventar
 * um total no navegador seria o comeco do problema que este modulo inteiro
 * existe para evitar.
 */
function useQuoteFulfillment(): QuoteInput['fulfillment'] | null {
  const { settings } = useStoreSettings();
  const { data: cities } = useDeliveryCities();

  const pickupEnabled = settings?.pickupEnabled === true;
  const firstCityId = cities?.[0]?.id ?? null;

  return useMemo(() => {
    if (pickupEnabled) {
      return { mode: 'PICKUP' };
    }

    return firstCityId === null ? null : { mode: 'DELIVERY', cityId: firstCityId };
  }, [pickupEnabled, firstCityId]);
}

/* ---- O aviso de reajuste ------------------------------------------------ */

/**
 * Anota os precos desta cotacao e decide se ha o que avisar.
 *
 * O efeito depende dos ids e dos precos da resposta, e nao do objeto: a
 * consulta devolve uma instancia nova a cada revalidacao, e comparar por
 * identidade reescreveria a anotacao — e reabriria o aviso — a cada ida ao
 * servidor.
 */
function usePriceNotice(quote: CartQuote | undefined): {
  pricesChanged: boolean;
  dismissPriceNotice: () => void;
} {
  const [dismissed, setDismissed] = useState(false);

  /**
   * O retrato de antes desta visita, lido uma vez.
   *
   * No inicializador do `useState`, e nao a cada render: a partir da segunda
   * cotacao o armazenamento ja tera sido reescrito pelo efeito abaixo, e
   * reler dali produziria a comparacao de uma coisa com ela mesma. O que
   * interessa e o que estava gravado quando o cliente chegou.
   */
  const [before] = useState(readPriceSnapshot);

  const items = quote?.items;

  // Derivado durante o render, e nao um estado que um efeito liga depois: o
  // aviso ja nasce pronto no quadro em que a cotacao chega, sem a segunda
  // renderizacao que um `setState` em efeito custaria.
  const changed = items !== undefined && items.length > 0 && pricesChangedSince(before, items);

  /**
   * A escrita fica no efeito porque e o que ela e: sincronizacao com um
   * sistema externo. Ela nao decide nada e nao mexe em estado nenhum.
   *
   * Roda a cada resposta nova — e nao so quando algum preco muda — e isso
   * esta certo: regravar os mesmos digests e barato e idempotente, e o que
   * decide o aviso e o `before` la de cima, capturado na montagem e imune a
   * estas escritas.
   */
  useEffect(() => {
    if (items !== undefined && items.length > 0) {
      writePriceSnapshot(items);
    }
  }, [items]);

  return {
    pricesChanged: changed && !dismissed,
    dismissPriceNotice: () => {
      setDismissed(true);
    },
  };
}

/* ---- Auxiliares --------------------------------------------------------- */

/** A sacola vazia nunca e cotada; este corpo so existe para o tipo fechar. */
const EMPTY_INPUT: QuoteInput = {
  items: [],
  fulfillment: { mode: 'PICKUP' },
  payment: { method: 'CARD', installments: 1 },
};

function split(items: readonly QuoteLine[]): { available: QuoteLine[]; unavailable: QuoteLine[] } {
  return {
    available: items.filter((item) => !item.unavailable),
    unavailable: items.filter((item) => item.unavailable),
  };
}
