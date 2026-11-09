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
import { IsOptionalImagePublicId } from '../../../common/image-public-id.js';
import {
  MAX_SHORTCUT_LABEL_LENGTH,
  MAX_SHORTCUT_LINK_LENGTH,
  MAX_SHORTCUT_ORDER,
} from '../settings.constants.js';

/**
 * Um atalho dentro do array que o PATCH recebe.
 *
 * `id` presente identifica atalho que já existe; ausente, o servidor cria. O
 * painel manda a fileira inteira a cada gravação — é o array que a tela edita
 * — e campo omitido volta ao padrão, porque aqui o item é o formulário
 * completo de um atalho, e não um retoque nele.
 *
 * Nome e destino são obrigatórios e a foto não é, ao contrário do banner:
 * banner sem arte não existe, mas círculo sem foto existe há tempos — ele cai
 * na inicial do nome, que é como a home já desenhava a categoria sem foto. O
 * que um atalho não pode é não dizer para onde vai.
 */
export class ShortcutDto {
  @IsOptional()
  @IsMongoId({ message: 'atalho inválido' })
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'escreva o nome que aparece embaixo do círculo' })
  @MaxLength(MAX_SHORTCUT_LABEL_LENGTH)
  label: string;

  /** `publicId` do Cloudinary. Vazio deixa o círculo com a inicial do nome. */
  @IsOptional()
  @IsString()
  @IsOptionalImagePublicId()
  image?: string;

  /** Para onde o atalho leva. Caminho interno ou URL, como o painel montar. */
  @IsString()
  @IsNotEmpty({ message: 'escolha para onde o atalho leva' })
  @MaxLength(MAX_SHORTCUT_LINK_LENGTH)
  link: string;

  /** Posição na fileira. Omitido, vale a posição no array recebido. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SHORTCUT_ORDER)
  order?: number;

  /** Desligamento manual, sem perder o atalho já montado. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
