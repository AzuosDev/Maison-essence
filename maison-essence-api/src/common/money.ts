/**
 * Dinheiro em texto, para os campos que o cliente le.
 *
 * O valor continua viajando em centavos: o rotulo e acrescimo, nunca
 * substituicao. Quem calcula usa `feeCents`, quem desenha usa `feeLabel`, e
 * nenhuma tela precisa reimplementar a virgula.
 *
 * Formatado a mao, e nao por `Intl.NumberFormat`. O ICU separa o "R$" do
 * numero com um espaco estreito sem quebra (U+00A0 ou U+202F, conforme a
 * versao do Node), e esse caractere invisivel viaja para a mensagem do
 * WhatsApp e para o teste, onde vira uma diferenca que ninguem consegue ver
 * na tela.
 */
export function formatCents(cents: number): string {
  const rounded = Math.trunc(cents);
  const sign = rounded < 0 ? '-' : '';
  const absolute = Math.abs(rounded);
  const reais = withThousands(Math.trunc(absolute / 100));
  const centavos = String(absolute % 100).padStart(2, '0');

  return `${sign}R$ ${reais},${centavos}`;
}

/** Separa os milhares com ponto: `150000` vira `1.500`. */
function withThousands(reais: number): string {
  return String(reais).replace(/\B(?=(?:\d{3})+$)/g, '.');
}
