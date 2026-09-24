import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { UserRole } from '../../../common/enums/user-role.js';
import { USER_ROLE_VALUES } from '../../../common/enums/user-role.js';

/** Edição de cadastro. Status e senha tem rota própria: são ações, não campos. */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'e-mail inválido' })
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsIn(USER_ROLE_VALUES, { message: 'papel inválido' })
  role?: UserRole;
}
