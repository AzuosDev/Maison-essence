import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsImagePublicId } from '../../../common/image-public-id.js';
import {
  MAX_POSTER_CAPTION_LENGTH,
  MAX_POSTER_LABEL_LENGTH,
  MAX_POSTER_LINK_LENGTH,
  MAX_POSTER_ORDER,
} from '../settings.constants.js';

/**
 * Um cartaz de coleção dentro do array que o PATCH recebe.
 *
 * Mesma regra do atalho e do banner: `id` presente identifica cartaz que já
 * existe, ausente o servidor cria, e o painel manda a faixa inteira a cada
 * gravação.
 *
 * A diferença está na foto, que aqui é **obrigatória**. O atalho sem foto cai
 * na inicial do nome e continua um atalho; o cartaz sem arte é um retângulo
 * cinza ocupando meia tela no meio da vitrine, e isso a home se recusa a
 * desenhar — recusar no PATCH é dizer o mesmo uma etapa antes, onde há quem
 * leia o aviso.
 */
export class CollectionPosterDto {
  @IsOptional()
  @IsMongoId({ message: 'cartaz inválido' })
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'escreva o nome que aparece sobre o cartaz' })
  @MaxLength(MAX_POSTER_LABEL_LENGTH)
  label: string;

  /** `publicId` do Cloudinary. Paisagem 16:9 — a home corta o resto. */
  @IsString()
  @IsNotEmpty({ message: 'escolha a arte do cartaz' })
  @IsImagePublicId()
  image: string;

  /** Para onde o cartaz leva. Caminho interno ou URL, como o painel montar. */
  @IsString()
  @IsNotEmpty({ message: 'escolha para onde o cartaz leva' })
  @MaxLength(MAX_POSTER_LINK_LENGTH)
  link: string;

  /** A linha de apoio embaixo do nome. Vazia é o padrão. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_POSTER_CAPTION_LENGTH)
  caption?: string;

  /** Posição na faixa. Omitido, vale a posição no array recebido. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_POSTER_ORDER)
  order?: number;

  /** Desligamento manual, sem perder o cartaz já montado. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
