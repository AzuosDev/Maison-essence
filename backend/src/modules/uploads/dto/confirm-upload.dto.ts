import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MAX_PUBLIC_ID_NAME_LENGTH } from '../../../common/image-public-id.js';

/**
 * O que o painel devolve depois que o Cloudinary aceitou o arquivo.
 *
 * O `publicId` não e validado por `@Matches` aqui de propósito: a recusa de
 * pasta e regra de domínio e merece 422 com frase própria, e não o 400 do
 * validador. Quem a enuncia e o `UploadsService`.
 *
 * Os metadados são aceitos porque o painel já os tem em mãos, mas não são
 * acreditados: o serviço confere o arquivo na conta e responde com os números
 * de lá. Tudo aqui e afirmação do cliente.
 */
export class ConfirmUploadDto {
  @IsString()
  @MaxLength(MAX_PUBLIC_ID_NAME_LENGTH + 40)
  publicId: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  format?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bytes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}
