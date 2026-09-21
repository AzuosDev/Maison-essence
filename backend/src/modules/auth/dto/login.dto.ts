import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Corpo de `POST /auth/login`. */
export class LoginDto {
  // Normalizado aqui e nao so no schema: e a mesma chave usada no rate limit,
  // e "Dona@Loja.com" nao pode contar como uma combinacao diferente de
  // "dona@loja.com".
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'e-mail invalido' })
  @MaxLength(160)
  email: string;

  // Sem regra de forca aqui: quem define a politica e a troca de senha. No
  // login, exigir formato so ajuda quem esta adivinhando.
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
