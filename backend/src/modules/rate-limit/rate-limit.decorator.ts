import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

/** Quantas chamadas, em quanto tempo e sob qual nome. */
export interface RateLimitRule {
  /**
   * Nome da regra, que separa os contadores.
   *
   * Sem ele, o mesmo IP gastaria no orçamento da cotação as chamadas que fez
   * na busca do catálogo — o limite precisa ser por rota, não por visitante.
   */
  scope: string;
  /** Chamadas permitidas dentro da janela. */
  limit: number;
  windowSeconds: number;
}

/**
 * Liga o limite na rota ou no controller.
 *
 * Sem o decorator o guard deixa passar: rota que não declarou regra não tem
 * limite, e o contrário — inventar um teto padrão — quebraria rota
 * administrativa que ninguém pediu para limitar.
 */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);
