import { dayEndISO, dayStartISO } from '@/lib/format';
import type { AdminOrderListParams } from './admin.keys';
import { ADMIN_PAGE_SIZE, ORDER_STATUSES, type OrderStatus } from './admin.types';

/**
 * Os filtros da tela de pedidos, e por que eles moram na URL.
 *
 * Tres razoes, e nenhuma delas e purismo:
 *
 * 1. **A abertura do painel manda para ca.** O card "Esperando contato"
 *    aponta para `?status=PENDING_CONTACT`, e so funciona se a tela ler o
 *    endereco em vez de comecar sempre do zero.
 * 2. **A dona manda o link.** "Olha esses tres pedidos de ontem" e uma
 *    mensagem com um endereco dentro. Filtro guardado em `useState` chega do
 *    outro lado como a lista inteira.
 * 3. **Voltar volta.** Abrir um pedido e apertar voltar devolve a lista no
 *    mesmo recorte e na mesma pagina — que e o que o botao do navegador
 *    promete.
 *
 * O modulo e todo funcao pura de propositio: e a parte que erra em silencio
 * — um fuso trocado, uma pagina que nao volta para 1 quando o filtro muda —
 * e a que vale testar sem montar tela nenhuma.
 */

/** O recorte, como os controles da tela o escrevem. */
export interface OrderFilters {
  /** Codigo do pedido ou telefone. O servidor procura nos dois. */
  q: string;
  /** Vazio e "qualquer status", e nao um status chamado vazio. */
  status: OrderStatus | '';
  /** `2026-09-22`, como o `<input type="date">` devolve. */
  from: string;
  to: string;
  page: number;
}

export const EMPTY_ORDER_FILTERS: OrderFilters = {
  q: '',
  status: '',
  from: '',
  to: '',
  page: 1,
};

const STATUS_VALUES: readonly string[] = Object.values(ORDER_STATUSES);

/**
 * O recorte que o endereco descreve.
 *
 * Nada aqui confia no que veio: o endereco e digitavel, colavel e
 * sobrevivente de uma versao anterior da tela. Um `status=ENTREGUE` de
 * alguem que traduziu o valor a mao vira "qualquer status" em vez de um
 * filtro que nao casa com nada, e `page=0` vira a primeira pagina em vez de
 * um `skip` negativo no servidor.
 */
export function readOrderFilters(search: URLSearchParams): OrderFilters {
  const status = search.get('status') ?? '';
  const page = Number.parseInt(search.get('page') ?? '', 10);

  return {
    q: (search.get('q') ?? '').trim(),
    status: STATUS_VALUES.includes(status) ? (status as OrderStatus) : '',
    from: isDate(search.get('from')) ? (search.get('from') ?? '') : '',
    to: isDate(search.get('to')) ? (search.get('to') ?? '') : '',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/**
 * O endereco que descreve o recorte.
 *
 * O que esta vazio nao entra: `/admin/pedidos` e mais curto de ler e de
 * mandar do que `/admin/pedidos?q=&status=&from=&to=&page=1`, e as duas
 * dizem a mesma coisa. A primeira pagina tambem some, pelo mesmo motivo.
 */
export function orderFiltersToSearch(filters: OrderFilters): Record<string, string> {
  const search: Record<string, string> = {};

  if (filters.q !== '') {
    search.q = filters.q;
  }

  if (filters.status !== '') {
    search.status = filters.status;
  }

  if (filters.from !== '') {
    search.from = filters.from;
  }

  if (filters.to !== '') {
    search.to = filters.to;
  }

  if (filters.page > 1) {
    search.page = String(filters.page);
  }

  return search;
}

/**
 * O recorte como a API o espera.
 *
 * Duas traducoes acontecem aqui. A data vira instante — `dayStartISO` e
 * `dayEndISO` explicam o fuso —, e o campo vazio some em vez de viajar como
 * texto em branco: `status=` chegaria ao `@IsIn` do backend e derrubaria a
 * consulta inteira com 400.
 */
export function orderListParams(filters: OrderFilters): AdminOrderListParams {
  return {
    page: filters.page,
    limit: ADMIN_PAGE_SIZE,
    ...(filters.q === '' ? {} : { q: filters.q }),
    ...(filters.status === '' ? {} : { status: filters.status }),
    ...(filters.from === '' ? {} : { from: dayStartISO(filters.from) }),
    // `to` inclusivo para quem preenche: escolher 30/09 nos dois campos
    // precisa trazer o dia 30 inteiro, e nao zero resultados.
    ...(filters.to === '' ? {} : { to: dayEndISO(filters.to) }),
  };
}

/**
 * Quantos filtros estao valendo.
 *
 * A pagina nao conta: ela e onde a pessoa esta, e nao o que ela pediu. O
 * numero vira o selo ao lado de "Filtros" no celular, onde os controles
 * ficam recolhidos e o recorte, sem ele, some da vista — que e como alguem
 * conclui que a loja nao vendeu nada, olhando para um filtro de setembro.
 */
export function activeFilterCount(filters: OrderFilters): number {
  return [filters.q, filters.status, filters.from, filters.to].filter((value) => value !== '')
    .length;
}

/** Um recorte novo, sempre de volta a primeira pagina. */
export function withFilter(filters: OrderFilters, patch: Partial<OrderFilters>): OrderFilters {
  // A pagina so sobrevive quando e ela que esta mudando. Trocar o status
  // estando na pagina 4 e pedir um recorte que talvez tenha duas: sem este
  // reset, a resposta e uma lista vazia que parece "nao ha pedidos assim".
  const page = patch.page ?? 1;

  return { ...filters, ...patch, page };
}

/** `2026-09-22`. So a forma: a data em si e validada por quem a usa. */
function isDate(value: string | null): boolean {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
