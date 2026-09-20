import { IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../auth.constants.js';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(128)
  newPassword: string;
}
