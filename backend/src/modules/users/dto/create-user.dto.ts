import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { UserRole } from '../../../common/enums/user-role.js';
import { USER_ROLE_VALUES } from '../../../common/enums/user-role.js';
import { PASSWORD_MIN_LENGTH } from '../../auth/auth.constants.js';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'e-mail inválido' })
  @MaxLength(160)
  email: string;

  @IsIn(USER_ROLE_VALUES, { message: 'papel inválido' })
  role: UserRole;

  /**
   * Senha temporaria, definida por quem cria. O registro nasce com
   * `mustChangePassword`, entao ela so serve para o primeiro login.
   */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(128)
  temporaryPassword: string;
}
