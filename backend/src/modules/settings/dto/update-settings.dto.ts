import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAX_CENTS } from '../../../database/schema-helpers.js';
import { IsWhatsappNumber } from '../whatsapp-number.js';
import { MAX_BANNERS } from '../settings.constants.js';
import { BannerDto } from './banner.dto.js';
import { InstitutionalPageDto } from './institutional-page.dto.js';
import { PickupAddressDto } from './pickup-address.dto.js';
import { SocialLinksDto } from './social-links.dto.js';

/**
 * Edição das configurações da loja. Campo omitido fica como esta.
 *
 * Três comportamentos convivem neste corpo, e a diferença entre eles e
 * deliberada:
 *
 * - campo simples: o valor recebido substitui o gravado;
 * - `pickupAddress` e `socialLinks`: fusão campo a campo, porque a tela manda
 *   só o que a dona mexeu;
 * - `banners`: substituição do array inteiro, porque e uma lista ordenável —
 *   o que sumiu dela foi removido de propósito;
 * - `institutionalPages`: atualização por `slug`, porque as cinco páginas
 *   existem sempre e cada uma e editada na sua própria tela.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  storeName?: string;

  /**
   * Normalizado antes de validar: `(88) 99999-9999` vira `5588999999999`.
   * Ver `whatsapp-number.ts` — e o campo de que depende todo pedido.
   */
  @IsOptional()
  @IsWhatsappNumber()
  whatsappNumber?: string;

  /** Texto da barra rolante no topo do site. Vazio tira a barra do ar. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  announcementText?: string;

  @IsOptional()
  @IsEmail({}, { message: 'informe um e-mail de contato válido' })
  @MaxLength(160)
  contactEmail?: string;

  /** Texto livre: "Seg a Sex, 9h as 18h". Não vale a pena modelar em campos. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessHours?: string;

  @IsOptional()
  @IsBoolean()
  pickupEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PickupAddressDto)
  pickupAddress?: PickupAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupInstructions?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  /**
   * Frete grátis acima deste valor, em qualquer cidade. `null` desliga a
   * regra, e a cidade que tiver mínimo próprio ignora este aqui — a regra da
   * cidade tem precedência (ver `delivery-fee.ts`).
   */
  @IsOptional()
  @IsInt({ message: 'o mínimo para frete grátis deve ser um inteiro em centavos' })
  @Min(0)
  @Max(MAX_CENTS)
  freeShippingMinCents?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BANNERS)
  @ValidateNested({ each: true })
  @Type(() => BannerDto)
  banners?: BannerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstitutionalPageDto)
  institutionalPages?: InstitutionalPageDto[];
}
