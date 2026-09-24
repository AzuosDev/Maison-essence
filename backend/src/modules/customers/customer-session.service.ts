import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import type { CustomerAccessTokenPayload } from '../auth/auth.types.js';
import { TokenService } from '../auth/token.service.js';
import { Customer } from './schemas/customer.schema.js';
import type { AuthenticatedCustomer } from './customer-auth.types.js';
import { toAuthenticatedCustomer } from './customer-auth.types.js';
import { readCustomerAccessToken } from './customer.cookies.js';

/**
 * Quem esta por trás de um access token da loja.
 *
 * Uma implementação para duas perguntas com respostas diferentes. A estratégia
 * do Passport pergunta "quem e?" e precisa de um erro quando não há ninguém; o
 * checkout pergunta "tem alguém?" e precisa seguir em frente quando não há.
 * Fossem duas implementações, a regra de conta desativada valeria em uma e
 * seria esquecida na outra.
 *
 * A consulta ao banco em todo request e o preço de `credentialVersion` valer
 * alguma coisa: sem ela, desativar uma conta ou derrubar as sessões só faria
 * efeito quando o token expirasse, até trinta minutos depois.
 */
@Injectable()
export class CustomerSessionService {
  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    private readonly tokens: TokenService,
  ) {}

  /** O cliente das claims, ou `null` se a conta não vale mais. */
  async loadFromPayload(
    payload: CustomerAccessTokenPayload,
  ): Promise<AuthenticatedCustomer | null> {
    const customer = await this.customers.findById(payload.sub).exec();

    if (
      !customer ||
      !customer.isActive ||
      customer.credentialVersion !== payload.credentialVersion
    ) {
      // Conta removida, desativada ou com as credenciais versionadas depois da
      // emissão: o token e válido na assinatura e inválido no conteúdo.
      return null;
    }

    return toAuthenticatedCustomer(customer);
  }

  /**
   * O cliente do request, quando há um. Nunca lança.
   *
   * E o que permite o checkout reconhecer quem esta logado sem nunca exigir
   * login: token ausente, expirado ou de conta desativada resultam todos em
   * `null`, e o pedido segue como convidado.
   */
  async resolve(request: Request): Promise<AuthenticatedCustomer | null> {
    const token = readCustomerAccessToken(request);

    if (token === null) {
      return null;
    }

    const payload = await this.tokens.readCustomerAccessToken(token);

    return payload === null ? null : this.loadFromPayload(payload);
  }
}
