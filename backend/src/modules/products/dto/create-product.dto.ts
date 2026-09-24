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

  /** Opcional: sem ele, o endereco sai do nome. */
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
   * `publicId`s do Cloudinary na ordem de exibicao: a posicao no array e a
   * ordenacao das fotos, e a primeira e a capa.
   *
   * So entra o que saiu do upload do painel, dentro das pastas da loja. E
   * esta linha que fecha a injecao: sem ela, qualquer string viraria foto de
   * produto e a vitrine passaria a carregar imagem de servidor alheio.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES)
  @IsString({ each: true })
  @IsImagePublicId({ each: true })
  images?: string[];

  /**
   * Sem `ArrayNotEmpty` de proposito: "produto sem variante nao existe" e
   * regra de dominio, e quem a enuncia e o schema — em portugues e com 422.
   * Barrar aqui responderia 400 com a frase generica do validador.
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

  /** Secao "pronta entrega". */
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
