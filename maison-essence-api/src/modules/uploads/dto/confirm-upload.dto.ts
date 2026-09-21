import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MAX_PUBLIC_ID_NAME_LENGTH } from '../../../common/image-public-id.js';

/**
 * O que o painel devolve depois que o Cloudinary aceitou o arquivo.
 *
 * O `publicId` nao e validado por `@Matches` aqui de proposito: a recusa de
 * pasta e regra de dominio e merece 422 com frase propria, e nao o 400 do
 * validador. Quem a enuncia e o `UploadsService`.
 *
 * Os metadados sao aceitos porque o painel ja os tem em maos, mas nao sao
 * acreditados: o servico confere o arquivo na conta e responde com os numeros
 * de la. Tudo aqui e afirmacao do cliente.
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
