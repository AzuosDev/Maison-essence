import { Type } from 'class-transformer';
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
import { MAX_IMAGES, MAX_VARIANTS } from '../products.constants.js';
import { ProductVariantDto } from './product-variant.dto.js';

/**
 * Edição do produto. Campo omitido fica como esta.
 *
 * `variants`, quando vem, vem inteiro: a lista recebida passa a ser a lista
 * do produto, e o que sumiu dela e removido ou aposentado. Enviar um array
 * parcial apagaria o resto sem querer — o painel manda o que a tela mostra.
 *
 * O endereço (`slug`) não esta aqui: ele já foi para o WhatsApp de alguém, e
 * troca-lo exige guardar o anterior para redirecionar, como a categoria faz.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

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

  /** `publicId`s do Cloudinary, só das pastas da loja. Ver o DTO de criação. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES)
  @IsString({ each: true })
  @IsImagePublicId({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

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
