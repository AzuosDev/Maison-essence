import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserAuditLog } from '../../common/user-audit.log.js';
import {
  Customer,
  CustomerSchema,
  LoginAttempt,
  LoginAttemptSchema,
  RefreshToken,
  RefreshTokenSchema,
  User,
  UserSchema,
} from '../../schemas.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { BootstrapService } from './bootstrap.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PendingPasswordGuard } from './guards/pending-password.guard.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { TokenService } from './token.service.js';

/**
 * Autenticacao do painel.
 *
 * O `JwtModule` e registrado sem segredo: cada token e assinado com o seu, em
 * `TokenService`. Os tres guards entram como `APP_GUARD` e nessa ordem: o
 * primeiro resolve o usuario, o segundo barra quem ainda esta com senha
 * temporaria e o terceiro confere o papel.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
      // O contador de credencial do cliente e incrementado pela revogacao em
      // massa, que vive em `RefreshTokenService`.
      { name: Customer.name, schema: CustomerSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    BootstrapService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    LoginRateLimitService,
    JwtStrategy,
    UserAuditLog,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PendingPasswordGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  // Exportados para o modulo de usuarios (criar usuario precisa do hash,
  // resetar senha e desativar precisam revogar as sessoes) e para os seeds,
  // que criam o primeiro SUPER_ADMIN pelo mesmo servico da rota.
  exports: [
    AuthService,
    BootstrapService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    UserAuditLog,
    MongooseModule,
  ],
})
export class AuthModule {}
