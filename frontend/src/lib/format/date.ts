/**
 * Data, sempre pelo `Intl` e sempre em pt-BR.
 *
 * A API devolve ISO 8601 em UTC; quem formata e o navegador, no fuso de quem
 * esta lendo. E o que faz o pedido das 22h de ontem aparecer como ontem para
 * a dona em Fortaleza e para o cliente em Sao Paulo, cada um no seu relogio.
 *
 * Toda funcao aceita `string | Date` porque o JSON entrega texto e o codigo
 * local costuma ter objeto: converter na entrada, em um lugar so, evita o
 * `new Date(...)` espalhado por componente.
 */

const DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Por extenso, para a pagina do pedido: `3 de outubro de 2026`. */
const LONG = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export type DateInput = string | number | Date;

/** `03/10/2026`. String vazia quando a data nao e valida. */
export function formatDate(value: DateInput): string {
  return format(DATE, value);
}

/** `03/10/2026 14:32`. */
export function formatDateTime(value: DateInput): string {
  return format(DATE_TIME, value);
}

/** `3 de outubro de 2026`. */
export function formatLongDate(value: DateInput): string {
  return format(LONG, value);
}

/**
 * O valor do atributo `dateTime` de um `<time>`.
 *
 * Existe para que a data legivel na tela venha sempre acompanhada da data
 * legivel por maquina, sem cada componente lembrar de chamar `toISOString`.
 */
export function toDateTimeAttribute(value: DateInput): string {
  const date = toDate(value);

  return date ? date.toISOString() : '';
}

/**
 * O comeco do dia escolhido, no fuso de quem esta olhando.
 *
 * `<input type="date">` devolve `2026-09-22`, e `new Date('2026-09-22')`
 * interpreta isso como meia-noite **UTC** — tres horas antes da meia-noite
 * daqui. Um filtro montado assim perderia tudo o que aconteceu entre 21h e
 * meia-noite do dia anterior, que e justamente o horario em que a loja mais
 * vende.
 *
 * O `T00:00:00` sem fuso e o que muda a leitura: a especificacao manda
 * interpretar data-e-hora sem fuso como **local**, e data sozinha como UTC.
 *
 * Nao passa pelo `Intl` como o resto deste arquivo — nao e texto para
 * alguem ler, e o valor que vai na query string. Mora aqui porque o assunto
 * e o mesmo, e porque duas copias dele em duas telas viram duas regras de
 * fuso diferentes no mesmo painel.
 */
export function dayStartISO(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

/** O fim do dia escolhido: "ate 30/09" precisa incluir o dia 30 inteiro. */
export function dayEndISO(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

/**
 * Texto vazio no lugar de `Invalid Date`.
 *
 * Data quebrada e um dado errado, nao uma tela quebrada: some do rotulo em
 * vez de escrever um erro do runtime no meio do resumo do pedido.
 */
function format(formatter: Intl.DateTimeFormat, value: DateInput): string {
  const date = toDate(value);

  return date ? formatter.format(date) : '';
}

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * O valor de um `<input type="date">` a partir de uma data ISO.
 *
 * A volta de `dayStartISO`, e existe pelo mesmo motivo que ele: `toISOString`
 * devolve UTC, e um banner agendado para as 21h de 22/09 em Fortaleza sairia
 * do campo como 23/09. O que o campo precisa e do dia **local**, e e o que as
 * tres partes montadas a mao devolvem.
 *
 * Texto vazio quando a data nao e valida — inclusive para `null`, que e o que
 * o servidor manda quando nao ha agendamento.
 */
export function dateInputValue(value: DateInput | null): string {
  if (value === null) {
    return '';
  }

  const date = toDate(value);

  if (!date) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${String(date.getFullYear())}-${month}-${day}`;
}
