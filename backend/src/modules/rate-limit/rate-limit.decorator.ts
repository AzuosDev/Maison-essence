import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

/** Quantas chamadas, em quanto tempo e sob qual nome. */
export interface RateLimitRule {
  /**
   * Nome da regra, que separa os contadores.
   *
   * Sem ele, o mesmo IP gastaria no orcamento da cotacao as chamadas que fez
   * na busca do catalogo — o limite precisa ser por rota, nao por visitante.
   */
  scope: string;
  /** Chamadas permitidas dentro da janela. */
  limit: number;
  windowSeconds: number;
}

/**
 * Liga o limite na rota ou no controller.
 *
 * Sem o decorator o guard deixa passar: rota que nao declarou regra nao tem
 * limite, e o contrario — inventar um teto padrao — quebraria rota
 * administrativa que ninguem pediu para limitar.
 */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);
