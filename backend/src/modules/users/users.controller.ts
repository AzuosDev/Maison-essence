import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
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
 * O `@Roles` no controller fecha o módulo inteiro no `SUPER_ADMIN`: conta de
 * painel não se cria, não se edita e não muda de papel sem quem mantem o
 * sistema. Sem isso, o gerente promoveria a si mesmo e a regra acabaria ali.
 *
 * A policy do módulo (`user-access.policy.ts`) continua valendo e continua
 * testada — ela e quem recusa atribuir papel acima do próprio e mudar o
 * próprio papel, e vale para o `SUPER_ADMIN` também. Que o OWNER já não
 * chegue até ela pelo HTTP não e razão para afrouxa-lá: ela e a segunda
 * tranca, e a segunda tranca serve justamente para o dia em que a primeira
 * for afrouxada por engano.
 */
@Roles(USER_ROLES.SUPER_ADMIN)
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
