import { imageUrl } from '@/lib/cloudinary';
import type { PageMeta } from '@/lib/use-page-meta';
import { formatCents, formatCentsRange } from '@/lib/format';
import type { PublicProductDetail, PublicVariant } from './catalog.types';

/**
 * O que o WhatsApp, o Google e o Instagram leem de um produto.
 *
 * Funcao pura, e de proposito: e ela que o hook `usePageMeta` chama no
 * navegador e e ela que o prerender do build vai chamar para escrever as
 * mesmas tags no HTML. Uma previa montada no componente nao poderia ser
 * reaproveitada pelo prerender, e ai haveria duas versoes da mesma previa —
 * a que o cliente ve depois do JavaScript e a que o rastreador leu antes.
 *
 * ## A previa do WhatsApp
 *
 * E o canal principal desta loja: o link do produto vai para a conversa, e o
 * que chega do outro lado e foto, titulo e descricao. Por isso a descricao
 * daqui **comeca pelo preco** quando o produto nao tem texto proprio: um
 * cartao que diz "Asad Lattafa — R$ 189,90, pronta entrega" vende; um que
 * repete o nome do produto duas vezes, nao.
 */

/** Quanto o cartao de previa mostra antes de cortar. */
const DESCRIPTION_LIMIT = 160;

export interface ProductMetaInput {
  product: PublicProductDetail;
  /** A variante escolhida, quando ha uma. Decide a foto e o preco do cartao. */
  variant: PublicVariant | null;
  /** O endereco canonico do produto, absoluto e sem parametros. */
  url: string;
}

export function productMeta({ product, variant, url }: ProductMetaInput): PageMeta {
  const description = metaDescriptionOf(product, variant);

  // A foto da previa e a da variante escolhida, quando ela tem uma: o link
  // do 100ml compartilhado no WhatsApp mostra o frasco de 100ml.
  const chosenImage = variant !== null && variant.image !== '' ? variant.image : product.coverImage;
  const image = absoluteImageOf(chosenImage);

  return {
    title: `${product.name} — Maison Essence`,
    description,
    canonical: url,
    type: 'product',
    ...(image === null ? {} : { image }),
    jsonLd: productJsonLd(product, url),
  };
}

/**
 * A descricao da previa: o texto do produto, ou o preco quando nao ha texto.
 *
 * O texto do painel vem com quebras de linha e pode ter cinco mil
 * caracteres; o cartao mostra uma linha e meia. Cortar na palavra — e nao no
 * caractere — e o que evita o "Perfume amadeirado com notas de sanda…"
 * terminando no meio de "sandalo".
 */
export function metaDescriptionOf(
  product: PublicProductDetail,
  variant: PublicVariant | null,
): string {
  const written = collapse(product.description);

  if (written !== '') {
    return truncate(written, DESCRIPTION_LIMIT);
  }

  const price =
    variant === null ? formatCentsRange(product.priceRangeCents) : formatCents(variant.priceCents);

  const parts = [
    product.brand === '' ? product.name : `${product.name}, ${product.brand}`,
    price,
    product.isReadyToShip ? 'pronta entrega' : null,
  ].filter((part): part is string => part !== null);

  return truncate(`${parts.join(' · ')}. Na Maison Essence.`, DESCRIPTION_LIMIT);
}

/**
 * Os dados estruturados do produto.
 *
 * Uma oferta por variante, cada uma com preco, disponibilidade e o endereco
 * que abre justamente ela — e o que permite ao Google mostrar "a partir de
 * R$ 180" e levar o clique para o tamanho certo. A marca vai como `Brand`, e
 * some quando o produto nao tem uma: `{"name": ""}` e pior que a ausencia,
 * porque e um campo preenchido com nada.
 *
 * Os precos vao com ponto decimal e sem simbolo — `189.90` —, que e o que a
 * especificacao pede. O `R$ 189,90` da tela e outra coisa, e serve a outro
 * leitor.
 */
export function productJsonLd(product: PublicProductDetail, url: string): Record<string, unknown> {
  const images = product.images
    .map((publicId) => absoluteImageOf(publicId))
    .filter((src): src is string => src !== null);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: metaDescriptionOf(product, null),
    ...(images.length === 0 ? {} : { image: images }),
    ...(product.brand === '' ? {} : { brand: { '@type': 'Brand', name: product.brand } }),
    offers: product.variants.map((variant) => ({
      '@type': 'Offer',
      url: variant.label === '' ? url : `${url}?variante=${encodeURIComponent(variant.id)}`,
      priceCurrency: 'BRL',
      price: decimalOf(variant.priceCents),
      availability: variant.isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      ...(variant.label === '' ? {} : { name: variant.label }),
    })),
  };
}

/**
 * A URL absoluta da foto, ou `null` quando nao ha foto.
 *
 * `imageUrl` devolve o marcador local (`/placeholder-product.svg`) quando o
 * `publicId` esta vazio ou o Cloudinary nao esta configurado — e um caminho
 * relativo nao serve para rastreador nenhum. Um endereco que nao comeca com
 * `http` e tratado como ausencia de imagem: sem foto, o cartao do WhatsApp
 * fica pequeno, que e melhor do que ficar quebrado.
 */
function absoluteImageOf(publicId: string): string | null {
  const src = imageUrl(publicId, 'detail');

  return src.startsWith('http') ? src : null;
}

/** `18990` vira `189.90`: o formato da especificacao, sem simbolo nem virgula. */
function decimalOf(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Quebras de linha e espacos repetidos viram um espaco so. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Corta na ultima palavra inteira que couber. */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
