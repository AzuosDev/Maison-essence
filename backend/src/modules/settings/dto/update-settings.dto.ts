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
 * Edicao das configuracoes da loja. Campo omitido fica como esta.
 *
 * Tres comportamentos convivem neste corpo, e a diferenca entre eles e
 * deliberada:
 *
 * - campo simples: o valor recebido substitui o gravado;
 * - `pickupAddress` e `socialLinks`: fusao campo a campo, porque a tela manda
 *   so o que a dona mexeu;
 * - `banners`: substituicao do array inteiro, porque e uma lista ordenavel —
 *   o que sumiu dela foi removido de proposito;
 * - `institutionalPages`: atualizacao por `slug`, porque as cinco paginas
 *   existem sempre e cada uma e editada na sua propria tela.
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
  @IsEmail({}, { message: 'informe um e-mail de contato valido' })
  @MaxLength(160)
  contactEmail?: string;

  /** Texto livre: "Seg a Sex, 9h as 18h". Nao vale a pena modelar em campos. */
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
   * Frete gratis acima deste valor, em qualquer cidade. `null` desliga a
   * regra, e a cidade que tiver minimo proprio ignora este aqui — a regra da
   * cidade tem precedencia (ver `delivery-fee.ts`).
   */
  @IsOptional()
  @IsInt({ message: 'o minimo para frete gratis deve ser um inteiro em centavos' })
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
