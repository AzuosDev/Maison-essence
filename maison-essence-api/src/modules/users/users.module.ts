import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/**
 * Usuarios administrativos.
 *
 * Importa o `AuthModule` inteiro: de la vem o model `User`, o hash de senha,
 * a revogacao de sessoes e a trilha de auditoria. A dependencia e so nesse
 * sentido — o modulo de autenticacao nao conhece este.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
