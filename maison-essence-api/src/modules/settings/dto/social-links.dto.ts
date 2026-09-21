import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Redes sociais do rodape.
 *
 * Texto livre, e nao URL validada, porque a dona cola tanto
 * `https://instagram.com/maisonessence` quanto `@maisonessence` — o frontend
 * monta o link a partir do que estiver aqui. Exigir URL no painel so
 * transformaria um rodape incompleto em um erro que ela nao sabe resolver.
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
