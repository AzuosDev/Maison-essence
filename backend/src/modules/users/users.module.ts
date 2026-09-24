import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/**
 * Usuários administrativos.
 *
 * Importa o `AuthModule` inteiro: de lá vem o model `User`, o hash de senha,
 * a revogação de sessões e a trilha de auditoria. A dependência e só nesse
 * sentido — o módulo de autenticação não conhece este.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
