import { env } from '@/lib/env';

/**
 * A URL de uma imagem do catalogo.
 *
 * Espelha `uploads/cloudinary.url.ts` do backend, transformacao por
 * transformacao, e a igualdade e o ponto: a API guarda so o `publicId` e
 * monta a URL na leitura com esta mesma regra. Se as duas pontas divergirem,
 * o navegador pede uma variante que ninguem mais pede e o cache do Cloudinary
 * deixa de ajudar — a primeira visita de cada foto passa a custar o
 * processamento inteiro.
 *
 * As tres transformacoes fixas:
 *
 * - `f_auto` entrega webp (ou avif) para quem suporta e jpg para o resto,
 *   decidindo pelo `Accept` do navegador;
 * - `q_auto` escolhe a compressao pelo conteudo da imagem;
 * - `c_limit` com a largura do contexto so reduz, nunca amplia: foto pequena
 *   nao vira borrao esticado.
 */

/**
 * Larguras de entrega por contexto, iguais as do backend.
 *
 * - `thumb`: miniatura do carrinho, da linha do pedido e da galeria;
 * - `card`: o card da vitrine, que e 3:4 em grid de ate quatro colunas;
 * - `detail`: a foto grande da pagina do produto.
 */
export const IMAGE_WIDTHS = { thumb: 400, card: 600, detail: 1200 } as const;

export type ImagePreset = keyof typeof IMAGE_WIDTHS;

export const IMAGE_PRESETS = Object.keys(IMAGE_WIDTHS) as ImagePreset[];

const TRANSFORMATION = 'f_auto,q_auto,c_limit';

/**
 * Enquanto nao ha foto.
 *
 * Produto sem imagem, `publicId` vazio ou ambiente de desenvolvimento sem
 * conta do Cloudinary caem todos aqui — e o card desenha um retangulo
 * discreto em vez de um icone de imagem quebrada.
 */
export const IMAGE_PLACEHOLDER = '/placeholder-product.svg';

/** `maison-essence/products/asad-9f3a1c` vira a URL da variante pedida. */
export function imageUrl(publicId: string | null | undefined, preset: ImagePreset): string {
  if (!publicId || !env.VITE_CLOUDINARY_CLOUD_NAME) {
    return IMAGE_PLACEHOLDER;
  }

  return deliveryUrl(publicId, IMAGE_WIDTHS[preset]);
}

/**
 * O `srcset` do mesmo `publicId` nas tres larguras.
 *
 * Vai junto do `src` e de um `sizes` que a tela informa: e assim que o
 * celular baixa a foto de 400px e o desktop retina baixa a de 1200px, sem
 * que o componente precise decidir nada.
 */
export function imageSrcSet(publicId: string | null | undefined): string | undefined {
  if (!publicId || !env.VITE_CLOUDINARY_CLOUD_NAME) {
    return undefined;
  }

  return IMAGE_PRESETS.map(
    (preset) => `${deliveryUrl(publicId, IMAGE_WIDTHS[preset])} ${IMAGE_WIDTHS[preset]}w`,
  ).join(', ');
}

/**
 * Tudo o que um `<img>` de catalogo precisa, de uma vez.
 *
 * `sizes` e obrigatorio quando ha `srcSet`: sem ele o navegador assume
 * `100vw` e escolhe a maior imagem ate no celular.
 */
export function imageProps(
  publicId: string | null | undefined,
  preset: ImagePreset,
  sizes: string,
): { src: string; srcSet?: string; sizes?: string } {
  const srcSet = imageSrcSet(publicId);

  return srcSet ? { src: imageUrl(publicId, preset), srcSet, sizes } : { src: IMAGE_PLACEHOLDER };
}

function deliveryUrl(publicId: string, width: number): string {
  const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME;

  return `https://res.cloudinary.com/${cloudName}/image/upload/${TRANSFORMATION},w_${width}/${publicId}`;
}
