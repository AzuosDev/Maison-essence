import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MANAGES_USERS } from '../../common/roles.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UsersService } from './users.service.js';
import type { PasswordResetResult } from './users.service.js';
import type { UserView } from './user.view.js';

/**
 * CRUD dos usuários do painel.
 *
 * O `@Roles` no controller barra o STAFF inteiro de uma vez; o
 * `SUPER_ADMIN` entra pelo guard, sem precisar ser listado. O que o OWNER
 * pode fazer com cada alvo — só STAFF — e decisão por registro, e por isso
 * mora na policy e não aqui.
 */
@Roles(...MANAGES_USERS)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser): Promise<UserView[]> {
    return this.users.list(actor);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserView> {
    return this.users.create(actor, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserView> {
    return this.users.update(actor, id, dto);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserView> {
    return this.users.setStatus(actor, id, dto);
  }

  /** Devolve a senha temporária uma única vez; não há como consulta-lá depois. */
  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PasswordResetResult> {
    return this.users.resetPassword(actor, id);
  }
}
