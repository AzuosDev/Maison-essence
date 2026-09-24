/**
 * Dinheiro em texto, para os campos que o cliente lê.
 *
 * O valor continua viajando em centavos: o rótulo e acrescimo, nunca
 * substituição. Quem calcula usa `feeCents`, quem desenha usa `feeLabel`, e
 * nenhuma tela precisa reimplementar a vírgula.
 *
 * Formatado a mão, e não por `Intl.NumberFormat`. O ICU separa o "R$" do
 * número com um espaço estreito sem quebra (U+00A0 ou U+202F, conforme a
 * versão do Node), e esse caractere invisível viaja para a mensagem do
 * WhatsApp e para o teste, onde vira uma diferença que ninguém consegue ver
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
