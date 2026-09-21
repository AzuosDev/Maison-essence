import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsOptionalImagePublicId } from '../../../common/image-public-id.js';
import { MAX_SLUG_LENGTH, slugify } from '../../../database/slug.js';
import { MAX_CATEGORY_ORDER } from '../categories.constants.js';

/**
 * Normaliza o slug digitado no painel antes de validar.
 *
 * A dona digita "Perfumes Arabes" no campo de endereco e o que vale e
 * `perfumes-arabes`. Passar pelo mesmo `slugify` da geracao automatica
 * garante que o slug escrito a mao e o gerado obedecam a mesma regra.
 */
export const NormalizeSlug = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? slugify(value) : value));

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  /** Opcional: sem ele, o slug sai do nome. */
  @IsOptional()
  @NormalizeSlug()
  @IsString()
  @MinLength(1, { message: 'o endereco precisa ter ao menos uma letra ou numero' })
  @MaxLength(MAX_SLUG_LENGTH)
  slug?: string;

  /** `null` (ou ausente) cria uma categoria principal. */
  @IsOptional()
  @IsMongoId({ message: 'categoria pai invalida' })
  parentId?: string | null;

  /** `publicId` do Cloudinary, so das pastas da loja. Vazio tira a foto. */
  @IsOptional()
  @IsString()
  @IsOptionalImagePublicId()
  image?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CATEGORY_ORDER)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
