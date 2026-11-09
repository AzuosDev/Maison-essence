import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsMongoId,
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
import { MAX_BANNERS, MAX_BEST_SELLERS, MAX_SHORTCUTS } from '../settings.constants.js';
import { BannerDto } from './banner.dto.js';
import { GiftDto } from './gift.dto.js';
import { InstitutionalPageDto } from './institutional-page.dto.js';
import { PickupAddressDto } from './pickup-address.dto.js';
import { ShortcutDto } from './shortcut.dto.js';
import { SocialLinksDto } from './social-links.dto.js';

/**
 * Edição das configurações da loja. Campo omitido fica como esta.
 *
 * Três comportamentos convivem neste corpo, e a diferença entre eles e
 * deliberada:
 *
 * - campo simples: o valor recebido substitui o gravado;
 * - `pickupAddress`, `socialLinks` e `gift`: fusão campo a campo, porque a
 *   tela manda só o que a dona mexeu;
 * - `banners`, `shortcuts` e `bestSellerProductIds`: substituição do array
 *   inteiro, porque são listas ordenáveis — o que sumiu delas foi removido
 *   de propósito;
 * - `institutionalPages`: atualização por `slug`, porque as seis páginas
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

  /**
   * O produto da seção "O perfume da vez". `null` devolve a escolha ao
   * primeiro destaque, que e o padrão da loja.
   *
   * Só o id e validado aqui. Se o produto existe, se esta no ar e se tem
   * variante a venda não e pergunta para a gravação das configurações: o
   * catálogo muda depois dela, e e na hora de montar a home que a resposta
   * importa — ver `PublicCatalogService.perfumeOfTheWeek`.
   */
  @IsOptional()
  @IsMongoId({ message: 'informe o id de um produto válido' })
  featuredPerfumeProductId?: string | null;

  /**
   * Os produtos da fileira "Mais vendidos" da home, na ordem da fileira.
   *
   * Array inteiro, como o carrossel e os atalhos: e uma lista ordenável, e o
   * produto que sumiu dela foi tirado de propósito. Lista vazia e resposta
   * legítima — devolve a fileira ao ranking das vendas, que e o que ela
   * sempre fez antes desta escolha existir.
   *
   * Como no perfume da vez, só o id e validado aqui: se o produto esta no ar
   * e se tem variante a venda e pergunta de quem monta a home, não de quem
   * grava as configurações — ver `PublicCatalogService.bestSellers`.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BEST_SELLERS)
  @IsMongoId({ each: true, message: 'informe ids de produtos válidos' })
  bestSellerProductIds?: string[];

  /**
   * O brinde por valor de compra: "Compre R$ 179,99 e ganhe um porta
   * hidratante".
   *
   * Fusão campo a campo, como `pickupAddress`: trocar o valor meta não apaga
   * a frase do balão. Que combinação de campos faz o brinde valer e pergunta
   * de quem o mostra, não de quem o grava — ver `gift.ts`.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => GiftDto)
  gift?: GiftDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BANNERS)
  @ValidateNested({ each: true })
  @Type(() => BannerDto)
  banners?: BannerDto[];

  /**
   * A fileira de atalhos da home: os círculos logo abaixo do banner.
   *
   * Array inteiro, como o carrossel — é uma lista ordenável, e o atalho que
   * sumiu dela foi removido de propósito. Lista vazia é resposta legítima e
   * não configuração pela metade: sem nenhum atalho a home volta a desenhar
   * as categorias-raiz, que é o que ela sempre fez.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SHORTCUTS)
  @ValidateNested({ each: true })
  @Type(() => ShortcutDto)
  shortcuts?: ShortcutDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstitutionalPageDto)
  institutionalPages?: InstitutionalPageDto[];
}
