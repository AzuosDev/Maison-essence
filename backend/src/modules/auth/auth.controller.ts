import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { resolveClientIp } from '../../common/client-ip.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { Env } from '../../config/env.schema.js';
import type { UserView } from '../users/user.view.js';
import { setSessionCookies, clearSessionCookies, readRefreshToken } from './auth.cookies.js';
import { AuthService } from './auth.service.js';
import type { RequestContext } from './auth.service.js';
import type { AuthSession, AuthenticatedUser } from './auth.types.js';
import {
  BOOTSTRAP_ALREADY_DONE_MESSAGE,
  BOOTSTRAP_ORIGINS,
  BOOTSTRAP_OUTCOMES,
  BootstrapNotConfiguredError,
  BootstrapService,
} from './bootstrap.service.js';
import { AllowPendingPassword } from './decorators/allow-pending-password.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { BootstrapSecretGuard } from './guards/bootstrap-secret.guard.js';

/**
 * Rotas de sessao do painel.
 *
 * Os tokens saem em duas vias: nos cookies `httpOnly` (o caminho do painel,
 * onde o JavaScript nunca toca no token) e no corpo da resposta, para o
 * cliente que nao aceita cookie de terceiro. Quem usa o corpo manda o access
 * token em `Authorization: Bearer` e o refresh no corpo do `/auth/refresh`.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly bootstrapper: BootstrapService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.login(dto, requestContext(request));

    setSessionCookies(response, session, this.isDevelopment);

    return session;
  }

  /**
   * Renova a sessao. Publica porque o access token expirado e justamente o
   * motivo da chamada: quem autentica aqui e o refresh token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const rawToken = readRefreshToken(request, dto.refreshToken);

    if (!rawToken) {
      throw new UnauthorizedException('Sessao invalida.');
    }

    const session = await this.auth.refresh(rawToken, requestContext(request));

    setSessionCookies(response, session, this.isDevelopment);

    return session;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshToken(request, dto.refreshToken));

    clearSessionCookies(response, this.isDevelopment);
  }

  /**
   * Encerra todas as sessoes do usuario, inclusive a atual: alem de revogar
   * os refresh tokens, incrementa `credentialVersion`, o que mata os access
   * tokens ja emitidos sem esperar os 15 minutos.
   */
  @AllowPendingPassword()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);

    clearSessionCookies(response, this.isDevelopment);
  }

  /**
   * Troca de senha do proprio usuario.
   *
   * E a unica rota administrativa liberada para quem esta com senha
   * temporaria — e, no caminho normal, tambem o fim desse estado. Responde
   * com uma sessao nova, ja sem a flag.
   */
  @AllowPendingPassword()
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.changePassword(user, dto, requestContext(request));

    setSessionCookies(response, session, this.isDevelopment);

    return session;
  }

  /**
   * Cria o primeiro SUPER_ADMIN de um banco vazio.
   *
   * Existe porque a Vercel nao da shell: sem esta rota, abrir o painel em
   * producao dependeria de rodar `npm run seed:superadmin` contra o banco de
   * la. Quem autoriza e o header `x-bootstrap-secret`, conferido pelo
   * `BootstrapSecretGuard` — sem `BOOTSTRAP_SECRET` no ambiente a rota
   * responde 404.
   *
   * `@Public()` porque nao ha como autenticar: esta e justamente a chamada
   * anterior a existir alguem para autenticar. Ela exige o banco sem usuario
   * nenhum, entao se fecha sozinha depois do primeiro acesso.
   */
  @Public()
  @UseGuards(BootstrapSecretGuard)
  @Post('bootstrap')
  @HttpCode(HttpStatus.CREATED)
  async bootstrap(): Promise<{ user: UserView }> {
    const result = await this.bootstrapper
      .run({ origin: BOOTSTRAP_ORIGINS.HTTP, requireEmptyDatabase: true })
      .catch((error: unknown) => {
        // Segredo certo, ambiente incompleto: quem chamou e o operador, e
        // dizer qual variavel falta poupa uma investigacao as cegas.
        if (error instanceof BootstrapNotConfiguredError) {
          throw new ServiceUnavailableException(error.message);
        }

        throw error;
      });

    if (result.outcome === BOOTSTRAP_OUTCOMES.ALREADY_BOOTSTRAPPED) {
      throw new ConflictException(BOOTSTRAP_ALREADY_DONE_MESSAGE);
    }

    return { user: result.user };
  }

  /** Quem esta logado. Liberada com senha temporaria: e por ela que o painel
   * descobre que precisa mandar o usuario trocar a senha. */
  @AllowPendingPassword()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private get isDevelopment(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'development';
  }
}

function requestContext(request: Request): RequestContext {
  return {
    ip: resolveClientIp(request),
    userAgent: request.get('user-agent') ?? '',
  };
}
