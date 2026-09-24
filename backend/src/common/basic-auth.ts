import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Usuario e senha que abrem a area protegida. */
export interface BasicCredentials {
  user: string;
  password: string;
}

/**
 * Confere um cabecalho `Authorization: Basic`.
 *
 * A comparacao e de digests de tamanho fixo, e nao das strings: `===` para de
 * comparar no primeiro caractere diferente, e a diferenca de tempo entre "erro
 * na primeira letra" e "erro na ultima" e suficiente para descobrir a senha
 * caractere a caractere em rede local. O SHA-256 nao protege a senha guardada
 * — ela esta em variavel de ambiente —, ele so iguala o tamanho dos dois lados
 * para que `timingSafeEqual` possa ser usado.
 */
export function matchesBasicAuth(
  header: string | undefined,
  credentials: BasicCredentials,
): boolean {
  const [scheme, encoded] = (header ?? '').split(' ');

  if (scheme?.toLowerCase() !== 'basic' || !encoded) {
    return false;
  }

  const expected = `${credentials.user}:${credentials.password}`;
  const received = Buffer.from(encoded, 'base64').toString('utf8');

  return timingSafeEqual(digestOf(received), digestOf(expected));
}

/**
 * Fecha um caminho atras de autenticacao basica.
 *
 * Basic e o suficiente para o que ele protege aqui — a documentacao, que nao
 * muda nada e nao contem dado de cliente — e tem a vantagem de o navegador
 * saber pedir a senha sozinho, sem tela de login para manter. Sobre HTTPS, a
 * credencial vai protegida; fora dele, nada nesta API deveria estar.
 */
export function basicAuth(credentials: BasicCredentials, realm: string): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (matchesBasicAuth(request.headers.authorization, credentials)) {
      next();

      return;
    }

    // Sem o `WWW-Authenticate` o navegador mostra a pagina de erro em vez de
    // pedir a senha.
    response.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    response.status(401).send('Autenticação necessária.');
  };
}

function digestOf(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
