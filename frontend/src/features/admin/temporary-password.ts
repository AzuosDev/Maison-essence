/**
 * A senha do primeiro acesso.
 *
 * ## Por que o painel gera, e não o servidor
 *
 * Não e escolha: `POST /users` **recebe** a senha, não a devolve. O servidor
 * só gera senha no reset (`POST /users/:id/reset-password`), onde não há
 * ninguém do outro lado para digitar uma. Na criação, alguém precisa
 * escolher, e deixar isso com quem cadastra significaria a senha da conta
 * nova sendo "loja123" numa sexta a tarde.
 *
 * Então o painel gera — com o mesmo alfabeto e o mesmo comprimento que o
 * servidor usa no reset, para que as duas senhas temporarias do sistema
 * tenham a mesma forma e a mesma força.
 *
 * ## Uma vez só
 *
 * A senha existe em texto por uma chamada. Ela e mostrada na tela que a
 * criou, com um botão de copiar, e não volta: o servidor guarda o hash
 * argon2, e não há rota que a recupere. Perder a senha antes de entrega-lá
 * custa um reset, que e barato — o que não pode existir e um lugar onde ela
 * fique guardada.
 *
 * Por isso ela também não entra no cache do React Query, não vai para o
 * `localStorage` e não aparece na URL.
 */

/**
 * O alfabeto, igual ao do `PasswordService` do backend.
 *
 * Sem `I`, `l`, `O`, `0` e `1`: a senha e lida em voz alta pelo WhatsApp ou
 * copiada de um bilhete, e esses cinco caracteres são onde a leitura erra.
 * A perda de entropia e irrelevante em dezesseis posições.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Dezesseis, como no backend. O mínimo que a API aceita e doze. */
export const TEMPORARY_PASSWORD_LENGTH = 16;

/**
 * Uma senha temporária nova.
 *
 * `crypto.getRandomValues` e não `Math.random`: a segunda e previsível a
 * partir de algumas saídas, e o que se esta gerando e a credencial de uma
 * conta que administra a loja.
 *
 * O módulo (`% ALPHABET.length`) introduz um vies teórico — 256 não e
 * multiplo de 57, então os primeiros 28 caracteres saem ~1,0004x mais que os
 * outros. Rejeitar os valores fora da faixa corrigiria isso; o ganho e
 * indistinguível e o custo e um laço que pode não terminar. Não vale.
 */
export function generateTemporaryPassword(length: number = TEMPORARY_PASSWORD_LENGTH): string {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length] ?? '').join('');
}

/**
 * Copia para a área de transferência, dizendo se conseguiu.
 *
 * `navigator.clipboard` não existe em contexto inseguro — e o painel aberto
 * por IP na rede da loja e um contexto inseguro. A função devolve `false` em
 * vez de estourar, e quem chama mostra a senha selecionável na tela: o
 * caminho manual continua existindo, e e ele que salva o cadastro.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}
