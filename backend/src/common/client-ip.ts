import type { Request } from 'express';

/**
 * IP de quem chamou, visto de dentro de uma funcao serverless.
 *
 * Na Vercel o socket vem sempre do proxy dela, entao `request.ip` devolve o
 * endereco da infraestrutura e serviria como chave unica para o mundo
 * inteiro. O cliente real esta no primeiro item de `x-forwarded-for`.
 *
 * Confiar nesse cabecalho so e seguro porque a Vercel o reescreve na borda: em
 * um deploy atras de outro proxy, este e o ponto a revisar.
 */
export function resolveClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];

  return first?.trim() || request.ip || request.socket.remoteAddress || 'desconhecido';
}
