/**
 * Junta classes, ignorando o que nao e classe.
 *
 * Existe por causa de duas coisas que acontecem o tempo todo nos primitivos:
 * a classe condicional (`isActive && styles.active`) e a classe que vem de
 * fora (`className`, que pode ser `undefined`). Sem isto, a alternativa e um
 * `.filter(Boolean).join(' ')` repetido em vinte arquivos — ou, pior, uma
 * string com `undefined` no meio dela.
 *
 * Nao e o `clsx`: nao aceita objeto nem array aninhado, porque nada aqui
 * precisa disso. Quatro linhas no lugar de uma dependencia.
 */
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
