import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * O refresh token, para quem não recebe cookie.
 *
 * Opcional porque o caminho normal e o cookie `httpOnly`: o corpo existe para
 * o cliente que não aceita cookie de terceiro, como o painel já faz.
 */
export class RefreshCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  refreshToken?: string;
}
