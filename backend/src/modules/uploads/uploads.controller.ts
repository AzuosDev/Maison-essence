import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MANAGES_STORE } from '../../common/roles.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';
import { CreateUploadSignatureDto } from './dto/create-upload-signature.dto.js';
import type { UploadSignature, UploadedImage } from './upload.view.js';
import { UploadsService } from './uploads.service.js';

/**
 * Envio de imagens do painel.
 *
 * `MANAGES_STORE` e so a dona; o `RolesGuard` ainda libera o SUPER_ADMIN por
 * conta propria. O STAFF fica de fora de proposito: ele le o catalogo para
 * atender, mas quem publica foto da loja e quem responde por ela.
 */
@Roles(...MANAGES_STORE)
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** 200 e nao 201: a assinatura autoriza, nao cria nada. */
  @Post('signature')
  @HttpCode(HttpStatus.OK)
  signature(@Body() dto: CreateUploadSignatureDto): UploadSignature {
    return this.uploads.signature(dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Body() dto: ConfirmUploadDto): Promise<UploadedImage> {
    return this.uploads.confirm(dto);
  }

  /**
   * O `publicId` tem barras (`maison-essence/products/foto-9f3a`), e barra
   * crua aqui viraria outro segmento de rota. O painel manda o identificador
   * percent-encoded — `%2F` nao casa com o separador na hora de escolher a
   * rota, e o Express entrega o valor ja decodificado.
   */
  @Delete(':publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('publicId') publicId: string): Promise<void> {
    return this.uploads.remove(publicId);
  }
}
