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
import { MAX_SLUG_LENGTH } from '../../../database/slug.js';
import { MAX_CATEGORY_ORDER } from '../categories.constants.js';
import { NormalizeSlug } from './create-category.dto.js';

/**
 * Edição de categoria. Todo campo e opcional: o painel manda só o que mudou.
 *
 * `parentId: null` promove a subcategoria a categoria principal; omitir o
 * campo deixa o pai como esta. Trocar o `slug` guarda o anterior em
 * `previousSlugs` — o link antigo continua abrindo, por redirecionamento.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @NormalizeSlug()
  @IsString()
  @MinLength(1, { message: 'o endereço precisa ter ao menos uma letra ou número' })
  @MaxLength(MAX_SLUG_LENGTH)
  slug?: string;

  @IsOptional()
  @IsMongoId({ message: 'categoria pai inválida' })
  parentId?: string | null;

  /** `publicId` do Cloudinary, só das pastas da loja. Vazio tira a foto. */
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
