import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes, randomInt } from 'node:crypto';

/**
 * Parametros do argon2id, na linha do que a OWASP recomenda: 19 MiB de
 * memoria, duas passagens e um grau de paralelismo.
 *
 * Memoria alta e o que encarece o ataque em GPU. O teto pratico aqui e a
 * funcao serverless: 19 MiB por verificacao cabe folgado nos 1024 MiB da
 * Vercel e custa algumas dezenas de milissegundos.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const TEMPORARY_PASSWORD_LENGTH = 16;

@Injectable()
export class PasswordService {
  /**
   * Hash descartavel, usado quando o e-mail nao existe.
   *
   * Sem ele o caminho "usuario inexistente" nao passaria pelo argon2 e
   * responderia visivelmente mais rapido que "senha errada". E uma promise
   * memoizada: o custo e pago uma vez por instancia.
   */
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  /**
   * Compara a senha com o hash. Sem hash (usuario inexistente) ela e
   * verificada contra o hash descartavel e o resultado e sempre `false`,
   * gastando o mesmo tempo do caminho legitimo.
   */
  async verify(hash: string | undefined | null, plain: string): Promise<boolean> {
    if (!hash) {
      await argon2.verify(await this.getDummyHash(), plain).catch(() => false);

      return false;
    }

    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash corrompido ou em formato antigo: e uma falha de autenticacao,
      // nao um erro 500 que vaza o estado do registro.
      return false;
    }
  }

  /**
   * Senha temporaria para reset: 16 caracteres de um alfabeto sem `0`, `O`,
   * `1`, `l` e `I`.
   *
   * Ela vai ser lida em voz alta ou copiada de uma tela para um WhatsApp, e
   * caractere ambiguo nesse caminho vira chamado de suporte. `randomInt` e o
   * sorteio uniforme do proprio Node, sem o vies de um `% alfabeto`.
   */
  generateTemporary(): string {
    return Array.from(
      { length: TEMPORARY_PASSWORD_LENGTH },
      () => TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)],
    ).join('');
  }

  /** `true` quando o hash foi gerado com parametros mais fracos que os atuais. */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomBytes(32).toString('hex'), ARGON2_OPTIONS);

    return this.dummyHash;
  }
}
