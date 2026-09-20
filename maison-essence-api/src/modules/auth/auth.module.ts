import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserAuditLog } from '../../common/user-audit.log.js';
import {
  LoginAttempt,
  LoginAttemptSchema,
  RefreshToken,
  RefreshTokenSchema,
  User,
  UserSchema,
} from '../../schemas.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
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
    ]),
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
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
  // Exportados para o modulo de usuarios: criar usuario precisa do hash,
  // resetar senha e desativar usuario precisam revogar as sessoes.
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    UserAuditLog,
    MongooseModule,
  ],
})
export class AuthModule {}
