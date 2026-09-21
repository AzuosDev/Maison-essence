import { ConflictException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { UPLOAD_FOLDERS, folderOf, isImagePublicId } from '../../common/image-public-id.js';
import { Category, Product, StoreSettings } from '../../schemas.js';
import type { CloudinaryAsset } from './cloudinary.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import { imageUrls } from './cloudinary.url.js';
import type { ConfirmUploadDto } from './dto/confirm-upload.dto.js';
import type { CreateUploadSignatureDto } from './dto/create-upload-signature.dto.js';
import { buildPublicId } from './public-id.js';
import type { ImageReferences, UploadSignature, UploadedImage } from './upload.view.js';
import {
  ALLOWED_IMAGE_FORMATS,
  FORMAT_ALIASES,
  INCOMING_TRANSFORMATION,
  MAX_UPLOAD_BYTES,
  SIGNATURE_TTL_SECONDS,
} from './uploads.constants.js';

export const FOREIGN_PUBLIC_ID_MESSAGE =
  'Esta imagem nao esta em nenhuma das pastas da loja e nao pode ser usada.';

export const IMAGE_NOT_UPLOADED_MESSAGE =
  'Imagem nao encontrada na conta. Envie o arquivo novamente.';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly cloudinary: CloudinaryService,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(StoreSettings.name) private readonly settings: Model<StoreSettings>,
  ) {}

  /**
   * Autoriza um envio, sem tocar no arquivo.
   *
   * O arquivo vai do navegador direto para o Cloudinary: a funcao serverless
   * da Vercel tem teto de corpo de requisicao e de tempo, e uma foto de
   * celular atravessando o backend gastaria os dois a toa.
   *
   * O que a assinatura prende:
   *
   * - `public_id` completo, montado aqui, com a pasta no caminho. E o que
   *   torna a pasta inegociavel: o navegador nao consegue desviar o arquivo
   *   para fora dela sem quebrar a assinatura;
   * - `allowed_formats`, que faz o Cloudinary recusar o que nao for imagem
   *   dos tres tipos;
   * - `transformation`, aplicada na entrada, que derruba o maior lado para o
   *   teto antes de guardar.
   *
   * Nao ha como prender o tamanho: `max_file_size` nao e parametro do upload
   * assinado, so de upload preset. O teto de 5 MB e conferido pelo painel
   * antes de enviar e pela API no `confirm`, que e o que de fato manda.
   */
  signature(dto: CreateUploadSignatureDto): UploadSignature {
    const { cloudName, apiKey } = this.cloudinary.credentials();
    // Segundos, nao milissegundos: o Cloudinary le o timestamp em unix time e
    // recusa assinatura com mais de uma hora — dai a validade do enunciado.
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = buildPublicId(dto.folder, dto.filename);
    const params = {
      allowed_formats: ALLOWED_IMAGE_FORMATS.join(','),
      public_id: publicId,
      timestamp,
      transformation: INCOMING_TRANSFORMATION,
    };

    return {
      cloudName,
      apiKey,
      timestamp,
      signature: this.cloudinary.sign(params),
      folder: UPLOAD_FOLDERS[dto.folder],
      publicId,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      params,
      expiresAt: new Date((timestamp + SIGNATURE_TTL_SECONDS) * 1000).toISOString(),
      maxBytes: MAX_UPLOAD_BYTES,
      allowedFormats: ALLOWED_IMAGE_FORMATS,
    };
  }

  /**
   * Confere a foto recem-enviada e devolve o identificador que pode ser
   * gravado em um produto.
   *
   * Duas perguntas, nesta ordem: o `publicId` e de uma pasta da loja, e o
   * arquivo existe mesmo na conta. A primeira barra a injecao — sem ela, o
   * painel (ou quem tomasse o token dele) gravaria qualquer string como foto,
   * inclusive o `publicId` da conta de um terceiro. A segunda barra o erro
   * honesto, que acabaria em card com imagem quebrada.
   *
   * Os metadados que o painel manda nao decidem nada: o que vale e o que a
   * conta responde. Divergencia vira aviso no log, porque sinaliza painel
   * desatualizado.
   */
  async confirm(dto: ConfirmUploadDto): Promise<UploadedImage> {
    const folder = folderOf(dto.publicId);

    if (folder === null) {
      throw new UnprocessableEntityException(FOREIGN_PUBLIC_ID_MESSAGE);
    }

    const asset = await this.cloudinary.findImage(dto.publicId);

    if (asset === null) {
      throw new UnprocessableEntityException(IMAGE_NOT_UPLOADED_MESSAGE);
    }

    if (dto.bytes !== undefined && dto.bytes !== asset.bytes) {
      this.logger.warn(
        `Metadado divergente em ${asset.publicId}: o painel informou ${dto.bytes} bytes, a conta tem ${asset.bytes}.`,
      );
    }

    await this.assertAllowed(asset);

    return {
      publicId: asset.publicId,
      folder,
      format: asset.format,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      urls: imageUrls(this.cloudinary.credentials().cloudName, asset.publicId),
    };
  }

  /**
   * Apaga a foto da conta, quando ninguem mais a usa.
   *
   * A conferencia vem antes porque remover imagem em uso nao quebra so a tela
   * onde a dona estava: quebra o card na vitrine, o menu e o banner da home,
   * em silencio, e ninguem liga uma coisa a outra depois. Recusar com a
   * contagem diz onde trocar a foto primeiro.
   */
  async remove(publicId: string): Promise<void> {
    if (!isImagePublicId(publicId)) {
      throw new UnprocessableEntityException(FOREIGN_PUBLIC_ID_MESSAGE);
    }

    const references = await this.referencesTo(publicId);
    const total = references.products + references.categories + references.banners;

    if (total > 0) {
      throw new ConflictException({
        message: inUseMessage(references),
        details: { ...references, total },
      });
    }

    // `false` significa que o arquivo ja nao estava la, o que e o estado
    // desejado: remover duas vezes responde 204 nas duas.
    await this.cloudinary.destroy(publicId);
  }

  /** Onde esta imagem aparece hoje, pasta por pasta. */
  private async referencesTo(publicId: string): Promise<ImageReferences> {
    const [products, categories, settings] = await Promise.all([
      this.products
        .countDocuments({ $or: [{ images: publicId }, { 'variants.image': publicId }] })
        .exec(),
      this.categories.countDocuments({ image: publicId }).exec(),
      this.settings.findOne({}).select('banners').lean().exec(),
    ]);

    const banners = (settings?.banners ?? []).filter(
      (banner) => banner.imageDesktop === publicId || banner.imageMobile === publicId,
    ).length;

    return { products, categories, banners };
  }

  /**
   * Formato e tamanho, conferidos na fonte.
   *
   * O arquivo que reprova e apagado: ele ja esta na conta, nunca sera
   * vinculado a nada e so ocuparia espaco — e ninguem voltaria para limpa-lo.
   */
  private async assertAllowed(asset: CloudinaryAsset): Promise<void> {
    const problem = problemWith(asset);

    if (problem === null) {
      return;
    }

    try {
      await this.cloudinary.destroy(asset.publicId);
    } catch (error) {
      // A recusa e o que importa; a sobra na conta e assunto de limpeza.
      this.logger.warn(`Nao foi possivel apagar ${asset.publicId} recusado: ${String(error)}`);
    }

    throw new UnprocessableEntityException(problem);
  }
}

/** O que reprova o arquivo, ou `null` quando ele passa. */
function problemWith(asset: CloudinaryAsset): string | null {
  const format = FORMAT_ALIASES[asset.format] ?? asset.format;

  if (!ALLOWED_IMAGE_FORMATS.some((allowed) => allowed === format)) {
    return `Formato nao aceito: ${asset.format}. Use JPG, PNG ou WebP.`;
  }

  if (asset.bytes > MAX_UPLOAD_BYTES) {
    return `A imagem tem ${megabytes(asset.bytes)} MB e o limite e ${megabytes(MAX_UPLOAD_BYTES)} MB.`;
  }

  return null;
}

function inUseMessage(references: ImageReferences): string {
  const places = [
    plural(references.products, 'produto', 'produtos'),
    plural(references.categories, 'categoria', 'categorias'),
    plural(references.banners, 'banner', 'banners'),
  ].filter((place) => place !== null);

  return `Esta imagem ainda e usada em ${places.join(' e ')}. Troque a foto la antes de remover.`;
}

function plural(count: number, singular: string, many: string): string | null {
  return count === 0 ? null : `${count} ${count === 1 ? singular : many}`;
}

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',');
}
