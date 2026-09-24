/**
 * Comparação de texto como uma pessoa a faria.
 *
 * Ninguém digita o acento ao procurar. Quem busca "acqua" espera achar
 * "Acqua di Gio", e quem filtra marcas digitando "lattafa" espera ver
 * "Lattafa". As duas telas — o realce da busca e a caixa de marcas da barra
 * de filtros — precisavam da mesma regra, e ela mora aqui para não existir
 * em duas versões que divergem depois.
 */

/**
 * Os sinais diacríticos, pela categoria Unicode deles.
 *
 * `\p{Mn}` e "marca sem espacamento" — a categoria a que pertence todo
 * acento que o `NFD` separa da letra. E a mesma coisa que a faixa
 * `[U+0300-U+036F]`, escrita de um jeito que da para ler: aquela faixa,
 * digitada com os caracteres literais, apareceria no editor como colchetes
 * vazios, porque os sinais são invisíveis sozinhos. Um padrão que ninguém
 * consegue conferir numa revisão e um padrão que quebra em silêncio.
 */
const DIACRITICS = /\p{Mn}/gu;

/**
 * Minúsculas e sem acento, **mantendo o comprimento original**.
 *
 * `NFD` separa a letra do sinal diacrítico, e o sinal e removido em seguida:
 * um "a" com acento agudo — um caractere — vira "a", também um caractere. A
 * igualdade de comprimento não e detalhe: e o que permite usar os índices
 * encontrados nesta copia para recortar o texto original, com os acentos que
 * a dona cadastrou.
 */
export function foldAccents(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}
