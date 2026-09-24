import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';
import type { InstitutionalPageSlug } from '../../../common/enums/institutional-page.js';
import { INSTITUTIONAL_PAGE_SLUG_VALUES } from '../../../common/enums/institutional-page.js';
import {
  EmbeddedSchema,
  baseSchemaOptions,
  embeddedSchemaOptions,
} from '../../../database/base.schema.js';
import {
  centsProp,
  createSchema,
  enumProp,
  integerProp,
  textProp,
} from '../../../database/schema-helpers.js';
import {
  SingletonSchema,
  applySingletonIndex,
  getOrCreateSingleton,
} from '../../../database/singleton.schema.js';

/** Endereço da loja, usado na retirada. */
@Schema(embeddedSchemaOptions({ _id: false }))
export class PickupAddress {
  @Prop(textProp({ max: 160, default: '' }))
  street: string;

  @Prop(textProp({ max: 20, default: '' }))
  number: string;

  @Prop(textProp({ max: 80, default: '' }))
  complement: string;

  @Prop(textProp({ max: 80, default: '' }))
  district: string;

  @Prop(textProp({ max: 120, default: '' }))
  city: string;

  @Prop(textProp({ max: 2, uppercase: true, default: '' }))
  state: string;

  @Prop(textProp({ max: 9, default: '' }))
  zipCode: string;

  /** Ponto de referência. Em cidade pequena vale mais que o CEP. */
  @Prop(textProp({ max: 200, default: '' }))
  reference: string;
}

export const PickupAddressSchema = createSchema(PickupAddress);

@Schema(embeddedSchemaOptions({ _id: false }))
export class SocialLinks {
  @Prop(textProp({ max: 200, default: '' }))
  instagram: string;

  @Prop(textProp({ max: 200, default: '' }))
  tiktok: string;
}

export const SocialLinksSchema = createSchema(SocialLinks);

/** Banner da home. Aparece só dentro do período de exibição, quando definido. */
@Schema(embeddedSchemaOptions())
export class Banner extends EmbeddedSchema {
  /** `publicId` do Cloudinary. Duas imagens porque o recorte do desktop não
   * funciona no mobile: a arte precisa ser outra, não a mesma redimensionada. */
  @Prop(textProp({ required: true, max: 200 }))
  imageDesktop: string;

  @Prop(textProp({ max: 200, default: '' }))
  imageMobile: string;

  @Prop(textProp({ max: 120, default: '' }))
  title: string;

  @Prop(textProp({ max: 200, default: '' }))
  subtitle: string;

  @Prop(textProp({ max: 40, default: '' }))
  buttonLabel: string;

  @Prop(textProp({ max: 300, default: '' }))
  link: string;

  @Prop(integerProp({ default: 0, max: 9999 }))
  order: number;

  /** Período de exibição. `null` nos dois lados significa "sempre". */
  @Prop({ type: Date, default: null })
  startsAt: Date | null;

  @Prop({ type: Date, default: null })
  endsAt: Date | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const BannerSchema = createSchema(Banner);

/**
 * Página institucional. O slug vem de uma lista fixa porque o endereço e
 * público e já circula; o que a dona edita e título e conteúdo.
 */
@Schema(embeddedSchemaOptions())
export class InstitutionalPage extends EmbeddedSchema {
  @Prop(enumProp(INSTITUTIONAL_PAGE_SLUG_VALUES, { required: true }))
  slug: InstitutionalPageSlug;

  @Prop(textProp({ required: true, max: 120 }))
  title: string;

  /** Markdown. O frontend renderiza; o banco guarda o texto como foi escrito. */
  @Prop(textProp({ max: 20_000, default: '' }))
  content: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const InstitutionalPageSchema = createSchema(InstitutionalPage);

/**
 * Configurações gerais da loja. Documento único.
 *
 * E o que torna o sistema operável sem programador: trocar o número do
 * WhatsApp aqui muda o destino de todo pedido, sem redeploy.
 */
@Schema(baseSchemaOptions({ collection: 'store_settings' }))
export class StoreSettings extends SingletonSchema {
  @Prop(textProp({ max: 80, default: 'Maison Essence' }))
  storeName: string;

  /**
   * Formato internacional, só digitos: `5588999999999`. O link `wa.me` não
   * aceita parênteses, traço nem espaço, e um número mal formatado só falha na
   * hora em que o cliente clica para enviar o pedido.
   */
  @Prop(
    textProp({
      max: 15,
      default: '',
      match: [
        /^\d{10,15}$/,
        'o número do WhatsApp deve ter só digitos, com pais e DDD, como 5588999999999',
      ],
    }),
  )
  whatsappNumber: string;

  /** Texto da barra rolante no topo do site. */
  @Prop(textProp({ max: 200, default: '' }))
  announcementText: string;

  @Prop(textProp({ max: 160, default: '', lowercase: true }))
  contactEmail: string;

  /** Texto livre: "Seg a Sex, 9h as 18h". Não vale a pena modelar em campos. */
  @Prop(textProp({ max: 200, default: '' }))
  businessHours: string;

  @Prop({ type: Boolean, default: false })
  pickupEnabled: boolean;

  // `default: () => ({})` faz o Mongoose materializar o subdocumento com os
  // defaults de cada campo, em vez de deixar o bloco inteiro ausente.
  @Prop({ type: PickupAddressSchema, default: () => ({}) })
  pickupAddress: PickupAddress;

  @Prop(textProp({ max: 500, default: '' }))
  pickupInstructions: string;

  @Prop({ type: SocialLinksSchema, default: () => ({}) })
  socialLinks: SocialLinks;

  /**
   * Frete grátis acima deste valor, valendo para qualquer cidade. `null`
   * desliga a regra. A regra da cidade, quando existe, tem precedência.
   */
  @Prop(centsProp({ default: null }))
  freeShippingMinCents: number | null;

  @Prop({ type: [BannerSchema], default: [] })
  banners: Banner[];

  @Prop({ type: [InstitutionalPageSchema], default: [] })
  institutionalPages: InstitutionalPage[];
}

export type StoreSettingsDocument = HydratedDocument<StoreSettings>;

export interface StoreSettingsModel extends Model<StoreSettings> {
  /** Devolve as configurações, criando-as com os padrões na primeira chamada. */
  getOrCreate(): Promise<StoreSettingsDocument>;
}

export const StoreSettingsSchema = createSchema(StoreSettings);

applySingletonIndex(StoreSettingsSchema);

StoreSettingsSchema.statics.getOrCreate = function (
  this: Model<StoreSettings>,
): Promise<StoreSettingsDocument> {
  return getOrCreateSingleton(this);
};
