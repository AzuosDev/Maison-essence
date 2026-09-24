import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Usuário e senha que abrem a área protegida. */
export interface BasicCredentials {
  user: string;
  password: string;
}

/**
 * Confere um cabeçalho `Authorization: Basic`.
 *
 * A comparação e de digests de tamanho fixo, e não das strings: `===` para de
 * comparar no primeiro caractere diferente, e a diferença de tempo entre "erro
 * na primeira letra" e "erro na última" e suficiente para descobrir a senha
 * caractere a caractere em rede local. O SHA-256 não protege a senha guardada
 * — ela esta em variável de ambiente —, ele só iguala o tamanho dos dois lados
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
 * Fecha um caminho atrás de autenticação básica.
 *
 * Basic e o suficiente para o que ele protege aqui — a documentação, que não
 * muda nada e não contem dado de cliente — e tem a vantagem de o navegador
 * saber pedir a senha sozinho, sem tela de login para manter. Sobre HTTPS, a
 * credencial vai protegida; fora dele, nada nesta API deveria estar.
 */
export function basicAuth(credentials: BasicCredentials, realm: string): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (matchesBasicAuth(request.headers.authorization, credentials)) {
      next();

      return;
    }

    // Sem o `WWW-Authenticate` o navegador mostra a página de erro em vez de
    // pedir a senha.
    response.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    response.status(401).send('Autenticação necessária.');
  };
}

function digestOf(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
