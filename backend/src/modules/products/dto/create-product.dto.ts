import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsImagePublicId } from '../../../common/image-public-id.js';
import { MAX_SLUG_LENGTH, slugify } from '../../../database/slug.js';
import { MAX_IMAGES, MAX_VARIANTS } from '../products.constants.js';
import { ProductVariantDto } from './product-variant.dto.js';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  /** Opcional: sem ele, o endereço sai do nome. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? slugify(value) : value,
  )
  @IsString()
  @MinLength(1, { message: 'o endereço precisa ter ao menos uma letra ou número' })
  @MaxLength(MAX_SLUG_LENGTH)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'categoria inválida' })
  categoryIds?: string[];

  /**
   * `publicId`s do Cloudinary na ordem de exibição: a posição no array e a
   * ordenação das fotos, e a primeira e a capa.
   *
   * Só entra o que saiu do upload do painel, dentro das pastas da loja. E
   * esta linha que fecha a injeção: sem ela, qualquer string viraria foto de
   * produto e a vitrine passaria a carregar imagem de servidor alheio.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES)
  @IsString({ each: true })
  @IsImagePublicId({ each: true })
  images?: string[];

  /**
   * Sem `ArrayNotEmpty` de propósito: "produto sem variante não existe" e
   * regra de domínio, e quem a enuncia e o schema — em português e com 422.
   * Barrar aqui responderia 400 com a frase genérica do validador.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Destaques da home. */
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  /** Seção "pronta entrega". */
  @IsOptional()
  @IsBoolean()
  isReadyToShip?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}
