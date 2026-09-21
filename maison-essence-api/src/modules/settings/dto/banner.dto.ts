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
 * `id` presente identifica banner que ja existe; ausente, o servidor cria. O
 * painel manda o carrossel inteiro a cada gravacao — e o array que a tela
 * edita — e campo omitido volta ao padrao, porque aqui o item e o formulario
 * completo de um banner, e nao um retoque nele.
 */
export class BannerDto {
  @IsOptional()
  @IsMongoId({ message: 'banner invalido' })
  id?: string;

  /** `publicId` do Cloudinary. Banner sem arte nao existe: e obrigatorio. */
  @IsString()
  @IsImagePublicId()
  imageDesktop: string;

  /**
   * Arte propria do celular. Vazio faz a home cair na imagem de desktop —
   * que costuma cortar mal no retrato, mas e melhor que espaco em branco.
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

  /** Posicao no carrossel. Omitido, vale a posicao no array recebido. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BANNER_ORDER)
  order?: number;

  /**
   * Periodo de exibicao. As duas datas sao opcionais e independentes: so
   * inicio agenda uma estreia, so fim agenda uma retirada, nenhuma das duas
   * significa "sempre no ar".
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de inicio invalida: use o formato ISO 8601' })
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'data de fim invalida: use o formato ISO 8601' })
  endsAt?: Date | null;

  /** Desligamento manual, sem perder as datas ja agendadas. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
