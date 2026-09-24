import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import type { SignableParams } from './cloudinary.signature.js';
import { signParams } from './cloudinary.signature.js';
import {
  CLOUDINARY_NOT_CONFIGURED_MESSAGE,
  CLOUDINARY_UNREACHABLE_MESSAGE,
} from './uploads.constants.js';

/** Credenciais da conta. O segredo nunca sai daqui. */
export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** O que interessa de um arquivo ja guardado na conta. */
export interface CloudinaryAsset {
  publicId: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  version: number;
}

/**
 * Teto de espera das chamadas ao Cloudinary.
 *
 * A funcao serverless da Vercel tem tempo contado, e uma chamada pendurada
 * consome o orcamento inteiro e ainda devolve o erro generico da plataforma.
 * Melhor desistir cedo com uma mensagem que a dona entende.
 */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Conversa com a API do Cloudinary.
 *
 * Separado do `UploadsService` de proposito: aqui fica o que depende de rede e
 * de credencial, e la fica a regra da loja. E a fronteira que os testes
 * trocam por um dublê para exercitar a regra sem sair da maquina.
 *
 * Sem SDK: as duas chamadas usadas sao `POST /image/destroy` e um `GET` de
 * consulta, ambas HTTP simples. Uma dependencia a menos no pacote e menos
 * tempo de cold start.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  isConfigured(): boolean {
    return (
      this.read('CLOUDINARY_CLOUD_NAME') !== '' &&
      this.read('CLOUDINARY_API_KEY') !== '' &&
      this.read('CLOUDINARY_API_SECRET') !== ''
    );
  }

  /**
   * As credenciais, ou 503.
   *
   * As tres variaveis sao opcionais no schema do ambiente porque a API precisa
   * subir sem elas — o backend vai ao ar antes da conta de imagens existir, e
   * nenhuma outra rota depende disso. Quem cobra a configuracao e a rota que
   * de fato precisa, no momento em que e chamada.
   */
  credentials(): CloudinaryCredentials {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(CLOUDINARY_NOT_CONFIGURED_MESSAGE);
    }

    return {
      cloudName: this.read('CLOUDINARY_CLOUD_NAME'),
      apiKey: this.read('CLOUDINARY_API_KEY'),
      apiSecret: this.read('CLOUDINARY_API_SECRET'),
    };
  }

  sign(params: SignableParams): string {
    return signParams(params, this.credentials().apiSecret);
  }

  /**
   * Consulta um arquivo na conta.
   *
   * `null` quando nao existe. E assim que o `confirm` descobre que o
   * `publicId` recebido e real: metadado vindo do navegador e afirmacao do
   * cliente, nao fato.
   */
  async findImage(publicId: string): Promise<CloudinaryAsset | null> {
    const { cloudName, apiKey, apiSecret } = this.credentials();
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const response = await this.request(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${publicId}`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      this.fail('consultar', publicId, response.status);
    }

    return toAsset(await this.json(response));
  }

  /**
   * Apaga o arquivo. `false` quando ele ja nao estava la.
   *
   * `invalidate` limpa as copias no CDN: sem isso, a foto trocada continuaria
   * aparecendo nas regioes que ja a tinham em cache.
   */
  async destroy(publicId: string): Promise<boolean> {
    const { cloudName, apiKey } = this.credentials();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { invalidate: 'true', public_id: publicId, timestamp };
    const body = new URLSearchParams({
      ...params,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature: this.sign(params),
    });

    const response = await this.request(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body },
    );

    if (!response.ok) {
      this.fail('remover', publicId, response.status);
    }

    const { result } = await this.json(response);

    return result === 'ok';
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      this.logger.error(`Falha de rede ao falar com o Cloudinary: ${String(error)}`);

      throw new BadGatewayException(CLOUDINARY_UNREACHABLE_MESSAGE);
    }
  }

  private async json(response: Response): Promise<Record<string, unknown>> {
    const payload: unknown = await response.json();

    if (typeof payload !== 'object' || payload === null) {
      throw new BadGatewayException(CLOUDINARY_UNREACHABLE_MESSAGE);
    }

    return payload as Record<string, unknown>;
  }

  private fail(action: string, publicId: string, status: number): never {
    // O corpo do erro do Cloudinary pode trazer detalhe da conta; fica no log.
    this.logger.error(`Não foi possível ${action} ${publicId}: HTTP ${status}`);

    throw new BadGatewayException(CLOUDINARY_UNREACHABLE_MESSAGE);
  }

  private read(key: 'CLOUDINARY_CLOUD_NAME' | 'CLOUDINARY_API_KEY' | 'CLOUDINARY_API_SECRET'): string {
    return this.config.get(key, { infer: true }) ?? '';
  }
}

function toAsset(payload: Record<string, unknown>): CloudinaryAsset {
  return {
    publicId: text(payload.public_id),
    format: text(payload.format),
    bytes: count(payload.bytes),
    width: count(payload.width),
    height: count(payload.height),
    version: count(payload.version),
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
