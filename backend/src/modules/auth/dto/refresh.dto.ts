import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Corpo opcional de `POST /auth/refresh` e `POST /auth/logout`.
 *
 * O caminho normal e o cookie. O campo existe para o cliente que não recebe
 * cookie de terceiro (app nativo, navegador com cookie cross-site bloqueado)
 * e precisa mandar o token no corpo.
 */
export class RefreshDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  refreshToken?: string;
}
