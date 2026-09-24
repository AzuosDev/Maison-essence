import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { checkoutKeys, type QuoteInput } from '@/features/checkout/checkout.keys';
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
 * Nenhuma tela do carrinho multiplica quantidade por preço. O subtotal, o
 * desconto por quantidade e o total saem daqui, e daqui saem calculados
 * contra o catálogo de agora: o preço que a dona mudou ontem, o produto que
 * ela desativou hoje e o estoque que acabou há dez minutos entram na conta
 * sem que o navegador precise saber de nada disso.
 *
 * ## O atraso de 400ms
 *
 * Quem aperta o "+" quatro vezes seguidas quer seis unidades, e não quatro
 * cotações. O atraso junta a rajada em uma consulta só, e o número antigo
 * fica na tela — esmaecido — até o novo chegar, em vez de a coluna de
 * valores piscar vazia a cada clique.
 *
 * A primeira cotação não espera: `useDebouncedValue` começa com o valor que
 * recebeu, então abrir a sacola dispara a consulta no mesmo quadro. O atraso
 * só existe para as mudancas seguintes, que são as únicas que se acumulam.
 *
 * ## A entrega, que a sacola não escolhe
 *
 * O resumo diz "frete a calcular", e diz a verdade: a cidade e escolhida no
 * fechamento do pedido, e o total que a sacola mostra e o dos produtos.
 *
 * Mas `POST /cart/quote` exige um modo de entrega — a rota serve também ao
 * checkout, onde a taxa e parte da conta —, e os dois modos tem exigência
 * própria: a retirada precisa estar ligada no painel, e a entrega precisa de
 * uma cidade atendida. `fulfillmentFor` escolhe o que a loja aceita hoje; a
 * taxa que voltar e simplesmente ignorada pela tela, que exibe o
 * `subtotalCents` como total. Nenhuma conta e refeita no navegador para
 * isso: e outro campo da mesma resposta.
 *
 * O pagamento vai como cartão a vista pelo mesmo motivo — e a forma que não
 * mexe no valor. O PIX desconta um percentual, e esse desconto pertence a
 * tela que o oferece, não a sacola.
 */

/** O atraso entre a última mexida e a cotação. */
export const QUOTE_DEBOUNCE_MS = 400;

export interface CartQuoteView {
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
   * Algum preço mudou desde a última visita.
   *
   * Comparado por impressão digital, sem guardar valor — ver `price-watch`.
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
        : { items: settled, fulfillment, payment: { method: 'card', installments: 1 } },
    [settled, fulfillment],
  );

  const query = useQuery<CartQuote>({
    // O `input` nulo nunca chega a ser chave: a consulta esta desligada.
    queryKey: checkoutKeys.quote(input ?? EMPTY_INPUT),
    queryFn: ({ signal }) => fetchCartQuote(input ?? EMPTY_INPUT, signal),
    enabled: input !== null,

    // Cotação não se serve de cache: o preço de um minuto atrás e um preço
    // que pode já não existir. Zero aqui não significa pedir a cada render —
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

/* ---- A entrega que a cotação exige -------------------------------------- */

/**
 * O modo de entrega que a loja aceita hoje.
 *
 * Retirada primeiro: não depende de cidade nenhuma e a taxa e zero, que e
 * exatamente o que a sacola quer de um campo que ela não vai mostrar. Sem
 * retirada, vale a primeira cidade atendida — qualquer uma serve, porque a
 * taxa que ela produz não entra na tela.
 *
 * `null` quando a loja não tem nem retirada nem cidade cadastrada. A
 * cotação fica desligada e a sacola mostra os itens sem totais, que e o
 * único desenho honesto: não há como essa loja fechar um pedido, e inventar
 * um total no navegador seria o começo do problema que este módulo inteiro
 * existe para evitar.
 */
function useQuoteFulfillment(): QuoteInput['fulfillment'] | null {
  const { settings } = useStoreSettings();
  const { data: cities } = useDeliveryCities();

  const pickupEnabled = settings?.pickupEnabled === true;
  const firstCityId = cities?.[0]?.id ?? null;

  return useMemo(() => {
    if (pickupEnabled) {
      return { mode: 'pickup' };
    }

    return firstCityId === null ? null : { mode: 'delivery', cityId: firstCityId };
  }, [pickupEnabled, firstCityId]);
}

/* ---- O aviso de reajuste ------------------------------------------------ */

/**
 * Anota os preços desta cotação e decide se há o que avisar.
 *
 * Exportado porque o checkout precisa do mesmo aviso: o "Comprar agora" da
 * página do produto pula a sacola e cai direto em `/checkout`, e quem chega
 * por ali com uma sacola de semanas atrás merece a mesma linha discreta
 * dizendo que os valores foram atualizados. Um segundo aviso escrito lá
 * teria que repetir a leitura do retrato anterior, a comparação por digest e
 * a regra de quando regravar — três coisas que só funcionam se forem
 * exatamente iguais nas duas telas.
 *
 * O efeito depende dos ids e dos preços da resposta, e não do objeto: a
 * consulta devolve uma instância nova a cada revalidação, e comparar por
 * identidade reescreveria a anotação — e reabriria o aviso — a cada ida ao
 * servidor.
 */
export function usePriceNotice(quote: CartQuote | undefined): {
  pricesChanged: boolean;
  dismissPriceNotice: () => void;
} {
  const [dismissed, setDismissed] = useState(false);

  /**
   * O retrato de antes desta visita, lido uma vez.
   *
   * No inicializador do `useState`, e não a cada render: a partir da segunda
   * cotação o armazenamento já terá sido reescrito pelo efeito abaixo, e
   * reler dali produziria a comparação de uma coisa com ela mesma. O que
   * interessa e o que estava gravado quando o cliente chegou.
   */
  const [before] = useState(readPriceSnapshot);

  const items = quote?.items;

  // Derivado durante o render, e não um estado que um efeito liga depois: o
  // aviso já nasce pronto no quadro em que a cotação chega, sem a segunda
  // renderização que um `setState` em efeito custaria.
  const changed = items !== undefined && items.length > 0 && pricesChangedSince(before, items);

  /**
   * A escrita fica no efeito porque e o que ela e: sincronização com um
   * sistema externo. Ela não decide nada e não mexe em estado nenhum.
   *
   * Roda a cada resposta nova — e não só quando algum preço muda — e isso
   * esta certo: regravar os mesmos digests e barato e idempotente, e o que
   * decide o aviso e o `before` lá de cima, capturado na montagem e imune a
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

/** A sacola vazia nunca e cotada; este corpo só existe para o tipo fechar. */
const EMPTY_INPUT: QuoteInput = {
  items: [],
  fulfillment: { mode: 'pickup' },
  payment: { method: 'card', installments: 1 },
};

function split(items: readonly QuoteLine[]): { available: QuoteLine[]; unavailable: QuoteLine[] } {
  return {
    available: items.filter((item) => !item.unavailable),
    unavailable: items.filter((item) => item.unavailable),
  };
}
