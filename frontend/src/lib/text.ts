/**
 * Comparacao de texto como uma pessoa a faria.
 *
 * Ninguem digita o acento ao procurar. Quem busca "acqua" espera achar
 * "Acqua di Gio", e quem filtra marcas digitando "lattafa" espera ver
 * "Lattafa". As duas telas — o realce da busca e a caixa de marcas da barra
 * de filtros — precisavam da mesma regra, e ela mora aqui para nao existir
 * em duas versoes que divergem depois.
 */

/**
 * Os sinais diacriticos, pela categoria Unicode deles.
 *
 * `\p{Mn}` e "marca sem espacamento" — a categoria a que pertence todo
 * acento que o `NFD` separa da letra. E a mesma coisa que a faixa
 * `[U+0300-U+036F]`, escrita de um jeito que da para ler: aquela faixa,
 * digitada com os caracteres literais, apareceria no editor como colchetes
 * vazios, porque os sinais sao invisiveis sozinhos. Um padrao que ninguem
 * consegue conferir numa revisao e um padrao que quebra em silencio.
 */
const DIACRITICS = /\p{Mn}/gu;

/**
 * Minusculas e sem acento, **mantendo o comprimento original**.
 *
 * `NFD` separa a letra do sinal diacritico, e o sinal e removido em seguida:
 * um "a" com acento agudo — um caractere — vira "a", tambem um caractere. A
 * igualdade de comprimento nao e detalhe: e o que permite usar os indices
 * encontrados nesta copia para recortar o texto original, com os acentos que
 * a dona cadastrou.
 */
export function foldAccents(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}
