import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  IsImagePublicId,
  IsOptionalImagePublicId,
} from '../../../common/image-public-id.js';
import { MAX_BANNER_ORDER } from '../settings.constants.js';

/**
 * Um banner dentro do array que o PATCH recebe.
 *
 * `id` presente identifica banner que já existe; ausente, o servidor cria. O
 * painel manda o carrossel inteiro a cada gravação — e o array que a tela
 * edita — e campo omitido volta ao padrão, porque aqui o item e o formulário
 * completo de um banner, e não um retoque nele.
 */
export class BannerDto {
  @IsOptional()
  @IsMongoId({ message: 'banner inválido' })
  id?: string;

  /** `publicId` do Cloudinary. Banner sem arte não existe: e obrigatório. */
  @IsString()
  @IsImagePublicId()
  imageDesktop: string;

  /**
   * Arte própria do celular. Vazio faz a home cair na imagem de desktop —
   * que costuma cortar mal no retrato, mas e melhor que espaço em branco.
   */
  @IsOptional()
  @IsString()
  @IsOptionalImagePublicId()
  imageMobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  buttonLabel?: string;

  /** Para onde o banner leva. Caminho interno ou URL, como a dona colar. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  link?: string;

  /** Posição no carrossel. Omitido, vale a posição no array recebido. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BANNER_ORDER)
  order?: number;

  /**
   * Período de exibição. As duas datas são opcionais e independentes: só
   * início agenda uma estreia, só fim agenda uma retirada, nenhuma das duas
   * significa "sempre no ar".
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de início inválida: use o formato ISO 8601' })
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de fim inválida: use o formato ISO 8601' })
  endsAt?: Date | null;

  /** Desligamento manual, sem perder as datas já agendadas. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
