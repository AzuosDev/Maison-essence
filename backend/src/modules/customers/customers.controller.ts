import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import type { Env } from '../../config/env.schema.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { CustomerAuthService } from './customer-auth.service.js';
import type { CustomerRequestContext } from './customer-auth.service.js';
import type { AuthenticatedCustomer } from './customer-auth.types.js';
import { readCustomerRefreshToken, setCustomerCookies } from './customer.cookies.js';
import type { CustomerSession, CustomerView } from './customer.view.js';
import {
  CUSTOMER_LOGIN_RATE_LIMIT,
  CUSTOMER_REFRESH_RATE_LIMIT,
  CUSTOMER_REGISTER_RATE_LIMIT,
} from './customers.constants.js';
import { CustomerAuth } from './decorators/customer-auth.decorator.js';
import { CurrentCustomer } from './decorators/current-customer.decorator.js';
import { LoginCustomerDto } from './dto/login-customer.dto.js';
import { RefreshCustomerDto } from './dto/refresh-customer.dto.js';
import { RegisterCustomerDto } from './dto/register-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

/**
 * A conta do cliente da loja.
 *
 * Tudo aqui e opcional para comprar: o checkout funciona sem nada disto, e a
 * conta existe para quem quiser acompanhar os pedidos e nao redigitar o
 * endereco. Por isso o cadastro nao pede nada alem do que o checkout ja
 * pediria, e por isso o telefone e a chave — e o que liga a conta aos pedidos
 * que ela ja tinha feito como convidado.
 *
 * Os tokens saem em duas vias, como no painel: cookies `httpOnly` proprios da
 * loja e o corpo da resposta, para quem nao aceita cookie de terceiro. Nada
 * nesta sessao carrega papel: nao ha claim, campo de resposta ou objeto de
 * request aqui que o controle de acesso do painel saiba ler.
 */
@Controller('customer')
export class CustomersController {
  constructor(
    private readonly customers: CustomerAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @RateLimit(CUSTOMER_REGISTER_RATE_LIMIT)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerSession> {
    const session = await this.customers.register(dto, context(request));

    setCustomerCookies(response, session, this.isDevelopment);

    return session;
  }

  @Public()
  @RateLimit(CUSTOMER_LOGIN_RATE_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerSession> {
    const session = await this.customers.login(dto, context(request));

    setCustomerCookies(response, session, this.isDevelopment);

    return session;
  }

  /**
   * Renova a sessao. Publica porque o access token expirado e justamente o
   * motivo da chamada: quem autentica aqui e o refresh token.
   */
  @Public()
  @RateLimit(CUSTOMER_REFRESH_RATE_LIMIT)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshCustomerDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerSession> {
    const rawToken = readCustomerRefreshToken(request, dto.refreshToken);

    if (!rawToken) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const session = await this.customers.refresh(rawToken, context(request));

    setCustomerCookies(response, session, this.isDevelopment);

    return session;
  }

  @CustomerAuth()
  @Get('me')
  me(@CurrentCustomer() customer: AuthenticatedCustomer): Promise<CustomerView> {
    // Recarrega do banco em vez de devolver o que o guard resolveu: o objeto
    // do guard e o minimo para autorizar, e a tela quer a conta inteira, com
    // os enderecos.
    return this.customers.profile(customer.id);
  }

  @CustomerAuth()
  @Patch('me')
  update(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerView> {
    return this.customers.update(customer.id, dto);
  }

  private get isDevelopment(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'development';
  }
}

function context(request: Request): CustomerRequestContext {
  return { userAgent: request.get('user-agent') ?? '' };
}
