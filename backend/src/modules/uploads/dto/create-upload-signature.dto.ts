import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UploadFolder } from '../../../common/image-public-id.js';
import { UPLOAD_FOLDER_KEYS } from '../../../common/image-public-id.js';

/** O painel pede a assinatura antes de escolher o arquivo. */
export class CreateUploadSignatureDto {
  /**
   * Onde a foto vai. Chave curta e não o caminho completo: quem decide a
   * pasta real e o servidor, e assim o navegador não tem como propor uma.
   */
  @IsIn(UPLOAD_FOLDER_KEYS, {
    message: `pasta inválida: use ${UPLOAD_FOLDER_KEYS.join(', ')}`,
  })
  folder: UploadFolder;

  /**
   * Nome do arquivo escolhido, só para o `publicId` sair legível.
   * `asad-lattafa.jpg` vira `maison-essence/products/asad-lattafa-9f3a1c2b`,
   * que a dona reconhece na biblioteca do Cloudinary. Sem ele, o identificador
   * e só o sorteio.
   */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  filename?: string;
}
