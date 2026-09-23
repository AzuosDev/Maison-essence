/**
 * Dinheiro, em um lugar so.
 *
 * Todo valor viaja da API em centavos, como inteiro — e continua assim aqui
 * dentro. Nenhum componente divide por cem, nenhum componente escreve
 * "R$ " na mao: quem calcula usa o numero, quem desenha chama `formatCents`.
 *
 * Formatado a mao, e nao por `Intl.NumberFormat`, pelo mesmo motivo que o
 * backend: o ICU separa o "R$" do numero com um espaco estreito sem quebra
 * (U+00A0 ou U+202F, conforme o navegador), e esse caractere invisivel faria
 * o preco da tela divergir do `priceLabel` que a API ja manda pronto e do
 * texto que vai para o WhatsApp. As duas pontas precisam escrever igual.
 */

/** `1250` vira `R$ 12,50`. Negativo vira `-R$ 12,50` — desconto no resumo. */
export function formatCents(cents: number): string {
  const rounded = Math.trunc(cents);
  const sign = rounded < 0 ? '-' : '';
  const absolute = Math.abs(rounded);
  const reais = withThousands(Math.trunc(absolute / 100));
  const centavos = String(absolute % 100).padStart(2, '0');

  return `${sign}R$ ${reais},${centavos}`;
}

/**
 * A faixa de preco de um produto com variantes.
 *
 * Quando as variantes custam o mesmo — ou o produto e simples — devolve um
 * preco so, em vez de repetir o mesmo valor dos dois lados do travessao.
 */
export function formatCentsRange(range: { min: number; max: number }): string {
  return range.min === range.max
    ? formatCents(range.min)
    : `${formatCents(range.min)} – ${formatCents(range.max)}`;
}

/**
 * `12x de R$ 41,67`. A conta de quanto e cada parcela e do servidor: aqui
 * entra o valor que ele ja devolveu, so para nao espalhar o "x de".
 */
export function formatInstallment(count: number, installmentCents: number): string {
  return `${count}x de ${formatCents(installmentCents)}`;
}

/**
 * O caminho inverso, para os campos de preco do painel.
 *
 * Aceita o que o teclado produz — `12,50`, `12.50`, `R$ 1.299,90` — e devolve
 * centavos, ou `null` quando o que veio nao e um numero. Nunca usa
 * `parseFloat` em cima do valor em reais: `19.99 * 100` da `1998.9999...`, e
 * o produto entra no banco um centavo mais barato.
 */
export function centsFromInput(value: string): number | null {
  const cleaned = value.trim().replace(/^R\$\s*/i, '');

  if (cleaned === '') {
    return null;
  }

  // O ultimo separador e o decimal; o resto e milhar e sai fora.
  const normalized = cleaned.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const negative = normalized.startsWith('-');
  const [reais = '0', centavos = ''] = normalized.replace('-', '').split('.');
  const total = Number(reais) * 100 + Number(centavos.padEnd(2, '0'));

  return negative ? -total : total;
}

/**
 * O valor de um campo de preco do painel: `19990` vira `199,90`.
 *
 * Companheiro de `centsFromInput`, e a volta exata dele — o que sai daqui,
 * relido por ele, devolve os mesmos centavos. Sem o simbolo da moeda e sem
 * separador de milhar: os dois atrapalham quem esta editando o numero, e
 * `centsFromInput` os aceita de volta se a pessoa quiser digita-los.
 *
 * Centavos sempre com duas casas, inclusive `,00`. Um campo que mostra
 * `199` e relido como `199,00` esta certo, mas ler `199` ao lado de
 * `89,90` na mesma coluna faz duvidar de qual dos dois tem centavos.
 */
export function centsToInput(cents: number): string {
  const rounded = Math.trunc(cents);
  const sign = rounded < 0 ? '-' : '';
  const absolute = Math.abs(rounded);

  return `${sign}${String(Math.trunc(absolute / 100))},${String(absolute % 100).padStart(2, '0')}`;
}

/** Separa os milhares com ponto: `150000` vira `1.500`. */
function withThousands(reais: number): string {
  return String(reais).replace(/\B(?=(?:\d{3})+$)/g, '.');
}
