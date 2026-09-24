import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Redes sociais do rodapé.
 *
 * Texto livre, e não URL validada, porque a dona cola tanto
 * `https://instagram.com/maisonessence` quanto `@maisonessence` — o frontend
 * monta o link a partir do que estiver aqui. Exigir URL no painel só
 * transformaria um rodapé incompleto em um erro que ela não sabe resolver.
 */
export class SocialLinksDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  instagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tiktok?: string;
}
