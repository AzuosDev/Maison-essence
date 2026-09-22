/**
 * A senha do primeiro acesso.
 *
 * ## Por que o painel gera, e nao o servidor
 *
 * Nao e escolha: `POST /users` **recebe** a senha, nao a devolve. O servidor
 * so gera senha no reset (`POST /users/:id/reset-password`), onde nao ha
 * ninguem do outro lado para digitar uma. Na criacao, alguem precisa
 * escolher, e deixar isso com quem cadastra significaria a senha da conta
 * nova sendo "loja123" numa sexta a tarde.
 *
 * Entao o painel gera — com o mesmo alfabeto e o mesmo comprimento que o
 * servidor usa no reset, para que as duas senhas temporarias do sistema
 * tenham a mesma forma e a mesma forca.
 *
 * ## Uma vez so
 *
 * A senha existe em texto por uma chamada. Ela e mostrada na tela que a
 * criou, com um botao de copiar, e nao volta: o servidor guarda o hash
 * argon2, e nao ha rota que a recupere. Perder a senha antes de entrega-la
 * custa um reset, que e barato — o que nao pode existir e um lugar onde ela
 * fique guardada.
 *
 * Por isso ela tambem nao entra no cache do React Query, nao vai para o
 * `localStorage` e nao aparece na URL.
 */

/**
 * O alfabeto, igual ao do `PasswordService` do backend.
 *
 * Sem `I`, `l`, `O`, `0` e `1`: a senha e lida em voz alta pelo WhatsApp ou
 * copiada de um bilhete, e esses cinco caracteres sao onde a leitura erra.
 * A perda de entropia e irrelevante em dezesseis posicoes.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Dezesseis, como no backend. O minimo que a API aceita e doze. */
export const TEMPORARY_PASSWORD_LENGTH = 16;

/**
 * Uma senha temporaria nova.
 *
 * `crypto.getRandomValues` e nao `Math.random`: a segunda e previsivel a
 * partir de algumas saidas, e o que se esta gerando e a credencial de uma
 * conta que administra a loja.
 *
 * O modulo (`% ALPHABET.length`) introduz um vies teorico — 256 nao e
 * multiplo de 57, entao os primeiros 28 caracteres saem ~1,0004x mais que os
 * outros. Rejeitar os valores fora da faixa corrigiria isso; o ganho e
 * indistinguivel e o custo e um laco que pode nao terminar. Nao vale.
 */
export function generateTemporaryPassword(length: number = TEMPORARY_PASSWORD_LENGTH): string {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length] ?? '').join('');
}

/**
 * Copia para a area de transferencia, dizendo se conseguiu.
 *
 * `navigator.clipboard` nao existe em contexto inseguro — e o painel aberto
 * por IP na rede da loja e um contexto inseguro. A funcao devolve `false` em
 * vez de estourar, e quem chama mostra a senha selecionavel na tela: o
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
