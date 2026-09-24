import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedCustomer } from '../customer-auth.types.js';
import { CustomerSessionService } from '../customer-session.service.js';

/**
 * Reconhece o cliente logado sem nunca exigir que ele esteja.
 *
 * E o guard do checkout. Com sessão, o pedido nasce ligado a conta; sem
 * sessão — ou com um token vencido, ou de uma conta desativada — o pedido
 * segue como convidado, que e o caminho padrão da loja e não pode ser
 * prejudicado por nada que aconteca aqui.
 *
 * Por isso ele nunca lança e sempre libera. Um erro de autenticação nesta
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
