import { UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedCustomer } from '../customer-auth.types.js';

type RequestWithCustomer = Request & { customer?: AuthenticatedCustomer };

/**
 * Cliente ja resolvido pelo guard. Nao vai ao banco: o `CustomerJwtStrategy`
 * carregou e validou a conta no mesmo request.
 */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedCustomer => {
    const request = context.switchToHttp().getRequest<RequestWithCustomer>();

    if (!request.customer) {
      // So acontece se alguem usar o decorator numa rota sem `@CustomerAuth()`.
      throw new UnauthorizedException('Autenticacao necessaria.');
    }

    return request.customer;
  },
);

/**
 * O cliente logado, ou `null`.
 *
 * Para as rotas que funcionam dos dois jeitos — o checkout, hoje a unica.
 * Depende do `OptionalCustomerGuard` ter passado antes; sem ele, o valor e
 * sempre `null`, que e o comportamento seguro: o pedido sai como convidado.
 */
export const OptionalCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedCustomer | null =>
    context.switchToHttp().getRequest<RequestWithCustomer>().customer ?? null,
);
