import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Corpo de `POST /auth/login`. */
export class LoginDto {
  // Normalizado aqui e não só no schema: e a mesma chave usada no rate limit,
  // e "Dona@Loja.com" não pode contar como uma combinação diferente de
  // "dona@loja.com".
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'e-mail inválido' })
  @MaxLength(160)
  email: string;

  // Sem regra de força aqui: quem define a política e a troca de senha. No
  // login, exigir formato só ajuda quem esta adivinhando.
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
