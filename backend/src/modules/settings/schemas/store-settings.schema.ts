import { Prop, Schema } from '@nestjs/mongoose';
import type { HydratedDocument, Model, Types } from 'mongoose';
import type { BannerPlacement } from '../../../common/enums/banner-placement.js';
import {
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_VALUES,
} from '../../../common/enums/banner-placement.js';
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
  objectIdListProp,
  objectIdProp,
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

/**
 * O brinde por valor de compra.
 *
 * "Compre R$ 179,99 e ganhe um porta hidratante" e mecânica real do negócio,
 * e até aqui ela não tinha onde morar: a vitrine a anunciava a partir de uma
 * constante do build, que só mudava por deploy. Agora e campo, e a dona liga,
 * desliga e troca o valor pelo painel, como faz com o frete grátis.
 *
 * Os quatro campos convivem assim:
 *
 * - `isActive` desliga a campanha sem desmanchar a configuração. E o que
 *   permite guardar o brinde do Natal em janeiro e trazê-lo de volta em
 *   dezembro sem redigitar nada;
 * - `minCents` e o valor que libera o brinde, medido pelo subtotal dos
 *   produtos — o mesmo número que a régua da sacola persegue;
 * - `productId` aponta o produto que a cliente ganha, e dele saem a foto e o
 *   nome. Guarda o id e não o nome pelo mesmo motivo do perfume da vez:
 *   corrigir o cadastro não pode desfazer a escolha da dona. O produto não
 *   precisa estar publicado — brinde não se vende, e exigir que ele estivesse
 *   a venda obrigaria a loja a pôr na vitrine uma coisa que não esta a venda;
 * - `label` e a frase que completa "Compre R$ 179,99 e ganhe ___". Vazia, o
 *   nome do produto ocupa o lugar; escrita, ela vence, porque "um porta
 *   hidratante com a melhor pasta árabe dentro" vende o que "Porta Hidratante
 *   ME" não vende.
 */
@Schema(embeddedSchemaOptions({ _id: false }))
export class StoreGift {
  /** Desligado nasce: brinde no ar e decisão, nunca padrão. */
  @Prop({ type: Boolean, default: false })
  isActive: boolean;

  /** O subtotal que libera o brinde. `null` e "ainda não escolhi o valor". */
  @Prop(centsProp({ default: null }))
  minCents: number | null;

  /** O produto que a cliente ganha. `null` deixa o brinde sem foto e sem nome. */
  @Prop(objectIdProp({ default: null }))
  productId: Types.ObjectId | null;

  /** A frase do balão. Vazia, vale o nome do produto. */
  @Prop(textProp({ max: 120, default: '' }))
  label: string;
}

export const StoreGiftSchema = createSchema(StoreGift);

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

  /**
   * A vaga da home que este banner ocupa.
   *
   * O padrão e o topo porque e onde todo banner já cadastrado estava quando a
   * vaga do meio nasceu: sem o `default`, a migração silenciosa deixaria o
   * carrossel vazio no dia do deploy.
   */
  @Prop(enumProp(BANNER_PLACEMENT_VALUES, { default: BANNER_PLACEMENTS.HERO }))
  placement: BannerPlacement;

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
 * Um atalho da fileira de círculos da home.
 *
 * ## O que ele e, e por que deixou de ser categoria
 *
 * A fileira logo abaixo do banner e a primeira navegação da loja: quem chega
 * pelo anúncio não tem um perfume em mente, tem uma intenção. Até aqui essa
 * fileira era, literalmente, as categorias-raiz do catálogo na ordem do
 * painel — e isso amarrava duas decisões diferentes num campo só. A dona não
 * podia pôr "Mais vendidos" na primeira tela sem inventar uma categoria vazia
 * para isso, nem destacar uma marca sem transformar a marca em categoria e
 * reclassificar sessenta produtos.
 *
 * Agora a fileira e lista própria: cada atalho tem o nome que a cliente lê, a
 * foto do círculo e o endereço para onde leva. A arvore de categorias volta a
 * ser só o que ela e — a organização do catálogo —, e o menu continua saindo
 * dela.
 *
 * ## O destino e um caminho, e não um tipo
 *
 * `link` guarda `/categorias/hidratantes`, `/produtos?marca=Isabelle%20La%20Belle`
 * ou `/mais-vendidos` — texto, como no banner. Modelar "categoria | marca |
 * rota" em campos separados daria um schema que precisa crescer toda vez que
 * a loja inventar um destino novo; o painel e que oferece as três formas de
 * preencher este campo sem a dona escrever caminho nenhum.
 *
 * ## Lista vazia não e lista quebrada
 *
 * Sem nenhum atalho cadastrado a home volta a desenhar as categorias-raiz,
 * que e o comportamento de sempre. Isso não e tolerância a configuração pela
 * metade: e o que garante que a loja nunca fica sem a primeira navegação da
 * página por causa de uma lista que ninguém preencheu ainda.
 */
@Schema(embeddedSchemaOptions())
export class Shortcut extends EmbeddedSchema {
  /** O nome embaixo do círculo. Curto: ele tem a largura do círculo. */
  @Prop(textProp({ required: true, max: 32 }))
  label: string;

  /**
   * `publicId` do Cloudinary. Vazio e legitimo — o círculo cai na inicial do
   * nome, como já fazia a categoria sem foto.
   */
  @Prop(textProp({ max: 200, default: '' }))
  image: string;

  /** Para onde o atalho leva. Caminho da loja ou endereço inteiro. */
  @Prop(textProp({ required: true, max: 300 }))
  link: string;

  @Prop(integerProp({ default: 0, max: 9999 }))
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const ShortcutSchema = createSchema(Shortcut);

/**
 * Um cartaz de colecao: as duas artes largas no meio da home.
 *
 * ## Por que nao sai mais das categorias
 *
 * Ate aqui a faixa desenhava as duas categorias-raiz com mais produtos que
 * tivessem foto — ninguem escolhia, o catalogo escolhia. A loja crescia e a
 * faixa trocava sozinha; e por "Victoria's Secret" ali, que e marca, ou
 * "Mais vendidos", que nao e categoria nenhuma, era impossivel sem inventar
 * uma categoria vazia e reclassificar produto.
 *
 * E a mesma amarra que `Shortcut` desfez na fileira de circulos, e a saida e
 * a mesma: lista propria, com nome, arte e destino.
 *
 * ## Lista propria, e nao os dois primeiros atalhos
 *
 * O cartaz e o circulo coincidem hoje — "Victoria's Secret" e "Mais
 * vendidos" sao os dois —, e ainda assim sao listas separadas. Amarra-las
 * faria o quarto circulo virar cartaz no dia em que a dona reordenasse a
 * fileira, e tiraria dela a escolha de destacar no meio da pagina algo que
 * nao esta na primeira tela. Sao duas decisoes, e duas decisoes moram em
 * dois campos.
 *
 * ## A arte e obrigatoria aqui
 *
 * Ao contrario do atalho, que sem foto cai na inicial do nome: cartaz sem
 * arte e um retangulo cinza de meia tela, e dois retangulos cinzas no meio
 * da vitrine sao piores do que nao ter a faixa. A home ja omitia o cartaz
 * sem foto quando eles saiam das categorias, e continua omitindo.
 */
@Schema(embeddedSchemaOptions())
export class CollectionPoster extends EmbeddedSchema {
  /** O nome escrito sobre a arte, no pe do cartaz. */
  @Prop(textProp({ required: true, max: 48 }))
  label: string;

  /**
   * `publicId` do Cloudinary. Obrigatorio: o cartaz e a arte.
   *
   * Paisagem 16:9 — a home desenha com `object-fit: cover` numa moldura
   * 16/9, e qualquer outra proporcao e cortada pelo centro.
   */
  @Prop(textProp({ required: true, max: 200 }))
  image: string;

  /** Para onde o cartaz leva. Caminho da loja ou endereco inteiro. */
  @Prop(textProp({ required: true, max: 300 }))
  link: string;

  /**
   * A linha de apoio, embaixo do nome.
   *
   * Vazia e legitima, e o padrao: quando os cartazes saiam das categorias
   * esta linha era a contagem de produtos, que a API devolvia. Lista propria
   * nao tem contagem para devolver — "Mais vendidos" nao e uma categoria que
   * se conte —, entao a dona escreve o que quiser ali, ou nada.
   */
  @Prop(textProp({ max: 64, default: '' }))
  caption: string;

  @Prop(integerProp({ default: 0, max: 9999 }))
  order: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CollectionPosterSchema = createSchema(CollectionPoster);

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

  /**
   * O produto da seção "O perfume da vez", na home.
   *
   * Guarda o id, e não o slug: renomear o produto troca o slug, e a escolha
   * da dona não pode se desfazer porque alguém corrigiu um nome no cadastro.
   *
   * `null` quer dizer "não escolhi", e aí a seção cai no primeiro destaque —
   * que era o único critério que existia antes deste campo. O mesmo acontece
   * quando o produto escolhido sai do ar: a home nunca fica com um bloco de
   * venda vazio por causa de uma escolha que envelheceu.
   */
  @Prop(objectIdProp({ default: null }))
  featuredPerfumeProductId: Types.ObjectId | null;

  /**
   * A fileira "Mais vendidos" da home, escolhida a dedo.
   *
   * ## Por que a lista existe
   *
   * Antes dela a fileira era o ranking dos pedidos, e quem a montava era a
   * cliente — comprando. Isso tem uma consequência que ninguém pediu: a
   * primeira fileira da home, a que mais vende, mostrava o que esgotou, o
   * que entrou num pedido grande de uma pessoa só, ou o frasco barato que
   * sai muito e não e o que a loja quer pôr na frente. Aqui a dona aponta os
   * produtos, na ordem em que eles aparecem.
   *
   * ## O id, e a ordem e o conteúdo
   *
   * O id e não o slug, pelo mesmo motivo do perfume da vez: renomear o
   * produto troca o slug, e a escolha não pode se desfazer porque alguém
   * corrigiu um nome no cadastro. A ordem do array e a ordem da fileira — o
   * primeiro id e o primeiro card.
   *
   * ## Lista vazia e o estado inicial, não uma fileira vazia
   *
   * Sem nenhuma escolha a fileira volta ao ranking das vendas completado
   * pelo catálogo, que era o único critério antes deste campo — a home nunca
   * abre sem a primeira fileira, inclusive no dia da inauguração. Com
   * escolha, a fileira e exatamente ela: três produtos escolhidos dao três
   * cards, e nada entra atrás para preencher. Ver
   * `PublicCatalogService.bestSellers`.
   */
  @Prop(objectIdListProp())
  bestSellerProductIds: Types.ObjectId[];

  /**
   * O brinde por valor de compra.
   *
   * Bloco inteiro e não quatro campos soltos porque as quatro decisões são uma
   * só: ligar o brinde sem valor, ou escolher o produto sem ligar, não e
   * campanha nenhuma. Ver `StoreGift`.
   */
  @Prop({ type: StoreGiftSchema, default: () => ({}) })
  gift: StoreGift;

  @Prop({ type: [BannerSchema], default: [] })
  banners: Banner[];

  /**
   * A fileira de círculos da home. Vazia, a home cai nas categorias-raiz.
   *
   * Ver `Shortcut`: a lista e própria justamente para que destacar uma marca
   * ou "Mais vendidos" na primeira tela não exija inventar uma categoria.
   */
  @Prop({ type: [ShortcutSchema], default: [] })
  shortcuts: Shortcut[];

  /**
   * Os dois cartazes largos no meio da home. Vazia, a faixa cai nas duas
   * categorias-raiz com mais produtos que tenham foto.
   *
   * Ver `CollectionPoster`: lista separada da dos atalhos de proposito.
   */
  @Prop({ type: [CollectionPosterSchema], default: [] })
  posters: CollectionPoster[];

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
