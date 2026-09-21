import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedCustomer } from '../customer-auth.types.js';
import { CustomerSessionService } from '../customer-session.service.js';

/**
 * Reconhece o cliente logado sem nunca exigir que ele esteja.
 *
 * E o guard do checkout. Com sessao, o pedido nasce ligado a conta; sem
 * sessao — ou com um token vencido, ou de uma conta desativada — o pedido
 * segue como convidado, que e o caminho padrao da loja e nao pode ser
 * prejudicado por nada que aconteca aqui.
 *
 * Por isso ele nunca lanca e sempre libera. Um erro de autenticacao nesta
 * rota seria uma venda perdida por um motivo que o cliente nem entenderia.
 */
@Injectable()
export class OptionalCustomerGuard implements CanActivate {
  constructor(private readonly sessions: CustomerSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { customer?: AuthenticatedCustomer }>();

    const customer = await this.sessions.resolve(request).catch(() => null);

    if (customer !== null) {
      request.customer = customer;
    }

    return true;
  }
}
