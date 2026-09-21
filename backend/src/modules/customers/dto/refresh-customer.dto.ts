import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * O refresh token, para quem nao recebe cookie.
 *
 * Opcional porque o caminho normal e o cookie `httpOnly`: o corpo existe para
 * o cliente que nao aceita cookie de terceiro, como o painel ja faz.
 */
export class RefreshCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  refreshToken?: string;
}
