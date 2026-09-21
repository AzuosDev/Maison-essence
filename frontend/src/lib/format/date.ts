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
