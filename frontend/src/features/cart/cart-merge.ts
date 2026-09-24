import { MAX_CART_LINES, MAX_LINE_QUANTITY, lineKey, type CartLine } from './cart.types';

/**
 * Duas sacolas viram uma.
 *
 * Acontece no login. O cliente monta a sacola sem se identificar — que e
 * como quase toda compra começa aqui —, e só na hora de fechar descobre que
 * já tinha conta. Nesse instante existem duas sacolas no mesmo navegador: a
 * que ele acabou de montar e a que ele deixou da última vez, guardada quando
 * saiu. Escolher uma delas perde a outra, e as duas perdas são ruins: jogar
 * fora o que ele acabou de escolher e pior, mas esquecer o que ele tinha
 * separado semana passada também custa a venda.
 *
 * ## Por que não há sacola no servidor
 *
 * A API tem uma rota de carrinho, `POST /cart/quote`, e ela não grava nada.
 * Não existe coleção de carrinho, não existe `GET /cart`. A sacola e do
 * navegador, e a mescla acontece aqui, entre duas chaves do `localStorage`.
 *
 * ## Como as duas se juntam
 *
 * Somando quantidades por linha, e linha e produto **mais variante**: dois
 * frascos de 50ml e um de 100ml do mesmo perfume são duas linhas, não uma.
 *
 * `base` e a sacola mais antiga — a que estava guardada — e `incoming` e a
 * desta visita. A ordem da lista continua sendo a de chegada, como em toda
 * sacola desta loja: o que ele separou semana passada aparece em cima, o que
 * acabou de escolher aparece embaixo. Nada se reorganiza debaixo do olho de
 * quem esta lendo.
 *
 * A mescla nunca estoura os tetos: nem o da linha, nem o do número de
 * linhas. Deixar passar só adiaria a recusa para a cotação.
 */
export function mergeCartLines(
  base: readonly CartLine[],
  incoming: readonly CartLine[],
): CartLine[] {
  const merged = new Map<string, CartLine>();

  for (const line of [...base, ...incoming]) {
    const key = lineKey(line.productId, line.variantId);
    const current = merged.get(key);

    if (current === undefined) {
      merged.set(key, { ...line, quantity: capQuantity(line.quantity) });

      continue;
    }

    current.quantity = capQuantity(current.quantity + line.quantity);
  }

  return [...merged.values()].slice(0, MAX_CART_LINES);
}

function capQuantity(quantity: number): number {
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_LINE_QUANTITY);
}

/* ---- Onde a sacola de cada cliente espera -------------------------------- */

/**
 * A sacola que um cliente deixou neste navegador.
 *
 * Uma chave por cliente, separada da sacola ativa. Ela e escrita quando ele
 * sai e lida quando ele volta — e só existe por isso: sem ela, o login nunca
 * teria com o que mesclar, e o requisito seria uma função que nunca roda.
 *
 * Guarda os mesmos três campos de sempre. Uma sacola parada por semanas e
 * justamente a que mais teria preço velho, se houvesse preço.
 */
const STASH_PREFIX = 'maison-essence.cart.customer.';

function stashKey(customerId: string): string {
  return `${STASH_PREFIX}${customerId}`;
}

/**
 * O que estava guardado, ou nada.
 *
 * Qualquer problema — armazenamento bloqueado, JSON corrompido, formato de
 * outra versão — devolve lista vazia. A sacola do cliente e conveniência; um
 * erro aqui não pode derrubar o login dele.
 */
export function readStashedCart(customerId: string): CartLine[] {
  try {
    const raw = localStorage.getItem(stashKey(customerId));

    return raw === null ? [] : sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeStashedCart(customerId: string, lines: readonly CartLine[]): void {
  try {
    if (lines.length === 0) {
      localStorage.removeItem(stashKey(customerId));

      return;
    }

    localStorage.setItem(stashKey(customerId), JSON.stringify(sanitize(lines)));
  } catch {
    // Armazenamento cheio ou bloqueado: a sacola desta visita continua de pe,
    // e o que se perde e a lembranca para a proxima.
  }
}

export function clearStashedCart(customerId: string): void {
  try {
    localStorage.removeItem(stashKey(customerId));
  } catch {
    // Ver acima.
  }
}

/**
 * Só os três campos, e só os que fazem sentido.
 *
 * O que vem do `localStorage` e texto que qualquer coisa pode ter escrito —
 * uma versão anterior desta loja, uma extensão, o console de alguém. Isto
 * aqui e a fronteira: o que passa e `{productId, variantId, quantity}` com
 * os dois ids preenchidos e a quantidade inteira e positiva. Um `price`
 * colado no meio do JSON e descartado antes de chegar a qualquer tela.
 */
function sanitize(value: unknown): CartLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): CartLine[] => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }

    const { productId, variantId, quantity } = entry as Record<string, unknown>;

    if (typeof productId !== 'string' || productId === '') {
      return [];
    }

    if (typeof variantId !== 'string' || variantId === '') {
      return [];
    }

    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) {
      return [];
    }

    return [{ productId, variantId, quantity: capQuantity(quantity) }];
  });
}
