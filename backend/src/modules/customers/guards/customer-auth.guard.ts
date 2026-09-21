import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CUSTOMER_JWT_STRATEGY } from '../strategies/customer-jwt.strategy.js';

/**
 * Exige uma sessao de cliente.
 *
 * O resultado vai para `request.customer`, e nao para `request.user`, porque
 * `user` e onde o painel guarda quem tem papel — e e de la que o `RolesGuard`
 * le. Com o cliente em outro campo, nao existe caminho em que uma conta de
 * loja seja confundida com um usuario administrativo: nem por engano de quem
 * escrever a proxima rota.
 */
@Injectable()
export class CustomerAuthGuard extends AuthGuard(CUSTOMER_JWT_STRATEGY) {
  override getAuthenticateOptions(_context: ExecutionContext): { property: string } {
    return { property: 'customer' };
  }
}
