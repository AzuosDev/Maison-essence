/**
 * O encontro entre o arquivo e o que já esta no banco.
 *
 * ## A regra única
 *
 * **O vazio do arquivo nunca apaga o que existe.** A lista de fornecedor traz
 * descrição vazia, foto nenhuma e estoque zero em todas as linhas — e o banco,
 * depois de umas semanas de painel, tem descrição escrita a mão, fotos subidas
 * uma a uma e o estoque que a dona contou na prateleira. Uma importação que
 * gravasse o arquivo por cima apagaria tudo isso de uma vez, em silêncio, e
 * sem volta.
 *
 * Então: campo preenchido no arquivo vence; campo vazio no arquivo cede. O
 * preço e a razão de existir da importação e por isso e o que mais vence — mas
 * `0` não e preço de nada, e cai na mesma regra. Uma lista exportada errada,
 * cheia de zeros, não zera o catálogo da loja.
 *
 * ## As chaves são do painel
 *
 * `isActive`, `isFeatured` e `isReadyToShip` entram quando o produto nasce e
 * nunca mais. São decisões de vitrine, tomadas no painel: o produto que a dona
 * destacou na home continua destacado, e o que ela tirou de linha não volta a
 * vender só porque a lista do fornecedor ainda o cita. O mesmo vale para
 * `order` e `image` da categoria, que o menu do painel edita.
 *
 * ## O `_id` da variante e sagrado
 *
 * O pedido guarda `items.variantId`. Trocar o `_id` de uma variante que
 * continua existindo seria o mesmo que apaga-lá e criar outra igual: o
 * cancelamento pararia de devolver estoque e o histórico apontaria para o
 * nada. Por isso o casamento e pelo SKU e o `_id` atravessa intacto.
 */

/** O produto como o arquivo o descreve, depois de validado. */
export interface IncomingProduct {
  name: string;
  slug: string;
  brand?: string;
  description?: string;
  categoryIds?: string[];
  images?: string[];
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  isReadyToShip?: boolean;
  variants?: IncomingVariant[];
}

export interface IncomingVariant {
  sku?: string;
  label?: string;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stock?: number;
  image?: string;
  isActive?: boolean;
  allowBackorder?: boolean;
}

/** O produto como esta gravado, reduzido ao que a fusão precisa enxergar. */
export interface StoredProduct {
  name: string;
  brand: string;
  description: string;
  categoryIds: string[];
  images: string[];
  tags: string[];
  variants: StoredVariant[];
}

export interface StoredVariant {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  image: string;
  isActive: boolean;
  allowBackorder: boolean;
}

/** Variante pronta para gravar. `_id` presente e variante que continua. */
export interface VariantData {
  _id?: string;
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stock: number;
  image: string;
  isActive: boolean;
  allowBackorder: boolean;
}

export interface ProductData {
  name: string;
  slug: string;
  brand: string;
  description: string;
  categoryIds: string[];
  images: string[];
  tags: string[];
  variants: VariantData[];
  /** Só quando o produto nasce; depois disso as chaves são do painel. */
  flags?: { isActive: boolean; isFeatured: boolean; isReadyToShip: boolean };
}

export interface ProductMerge {
  data: ProductData;
  /** Variantes que este produto ganhou agora. */
  variantsCreated: number;
  /** Variantes que sumiram do arquivo e acabaram de ser desativadas. */
  variantsDeactivated: number;
}

/**
 * Funde a entrada do arquivo com o produto gravado.
 *
 * `stored` nulo e produto novo: tudo vem do arquivo, inclusive as chaves.
 */
export function mergeProduct(
  incoming: IncomingProduct,
  stored: StoredProduct | null,
): ProductMerge {
  const variants = mergeVariants(incoming.variants ?? [], stored?.variants ?? []);

  return {
    data: {
      name: incoming.name,
      slug: incoming.slug,
      brand: keepFilled(incoming.brand, stored?.brand ?? ''),
      description: keepFilled(incoming.description, stored?.description ?? ''),
      categoryIds: keepFilledList(incoming.categoryIds, stored?.categoryIds ?? []),
      images: keepFilledList(incoming.images, stored?.images ?? []),
      tags: keepFilledList(incoming.tags, stored?.tags ?? []),
      variants: variants.data,
      ...(stored === null
        ? {
            flags: {
              isActive: incoming.isActive ?? true,
              isFeatured: incoming.isFeatured ?? false,
              isReadyToShip: incoming.isReadyToShip ?? false,
            },
          }
        : {}),
    },
    variantsCreated: variants.created,
    variantsDeactivated: variants.deactivated,
  };
}

/**
 * Casa as variantes pelo SKU.
 *
 * Três destinos: a que o arquivo traz e o banco tem e atualizada no lugar; a
 * que só o arquivo traz nasce; a que só o banco tem e desativada, nunca
 * apagada — pode estar num pedido, e o `_id` dela e o que devolve o estoque
 * no cancelamento.
 *
 * A contagem de desativadas conta só quem estava ativa. Sem isso, toda
 * importação repetiria para sempre o mesmo número de "desativadas" e o
 * relatório deixaria de descrever o que aconteceu naquela execução.
 */
function mergeVariants(
  incoming: readonly IncomingVariant[],
  stored: readonly StoredVariant[],
): { data: VariantData[]; created: number; deactivated: number } {
  const bySku = new Map(stored.map((variant) => [normalizeSku(variant.sku), variant]));
  const matched = new Set<string>();
  const data: VariantData[] = [];
  let created = 0;

  for (const variant of incoming) {
    const sku = normalizeSku(variant.sku ?? '');
    const current = sku.length > 0 ? bySku.get(sku) : undefined;

    if (current === undefined) {
      data.push(newVariant(variant, sku));
      created += 1;

      continue;
    }

    matched.add(sku);
    data.push(updatedVariant(variant, current));
  }

  let deactivated = 0;

  for (const variant of stored) {
    if (matched.has(normalizeSku(variant.sku))) {
      continue;
    }

    data.push({ ...variantData(variant), _id: variant.id, isActive: false });

    if (variant.isActive) {
      deactivated += 1;
    }
  }

  return { data, created, deactivated };
}

/** Variante nova: o arquivo manda, com o padrão de cada campo omitido. */
function newVariant(incoming: IncomingVariant, sku: string): VariantData {
  return {
    sku,
    label: incoming.label ?? '',
    priceCents: incoming.priceCents,
    compareAtPriceCents: incoming.compareAtPriceCents ?? null,
    stock: incoming.stock ?? 0,
    image: incoming.image ?? '',
    isActive: incoming.isActive ?? true,
    allowBackorder: incoming.allowBackorder ?? false,
  };
}

/**
 * Variante que continua: o preço do arquivo, o resto do banco quando o
 * arquivo vem vazio.
 *
 * `isActive` e `allowBackorder` nem são consultados no arquivo. Quem desativou
 * uma variante no painel não quer que a lista do fornecedor a reative na
 * próxima importação de preço.
 */
function updatedVariant(incoming: IncomingVariant, current: StoredVariant): VariantData {
  const stock = incoming.stock ?? 0;

  return {
    _id: current.id,
    sku: current.sku,
    label: keepFilled(incoming.label, current.label),
    priceCents: incoming.priceCents > 0 ? incoming.priceCents : current.priceCents,
    compareAtPriceCents: incoming.compareAtPriceCents ?? current.compareAtPriceCents,
    stock: stock > 0 ? stock : current.stock,
    image: keepFilled(incoming.image, current.image),
    isActive: current.isActive,
    allowBackorder: current.allowBackorder,
  };
}

function variantData(variant: StoredVariant): VariantData {
  return {
    sku: variant.sku,
    label: variant.label,
    priceCents: variant.priceCents,
    compareAtPriceCents: variant.compareAtPriceCents,
    stock: variant.stock,
    image: variant.image,
    isActive: variant.isActive,
    allowBackorder: variant.allowBackorder,
  };
}

/* ---- Categorias ----------------------------------------------------------- */

export interface IncomingCategory {
  name: string;
  slug: string;
  order?: number;
  isActive?: boolean;
}

export interface StoredCategory {
  name: string;
  order: number;
  isActive: boolean;
  image: string;
}

export interface CategoryData {
  name: string;
  slug: string;
  parentId: string | null;
  order: number;
  isActive: boolean;
  image: string;
}

/**
 * Funde a categoria do arquivo com a gravada.
 *
 * O arquivo manda no nome e no lugar dela na árvore. A posição no menu
 * (`order`), a foto e o interruptor ficam com o painel: reordenar o menu e
 * trabalho, e uma importação de preço não desfaz trabalho.
 */
export function mergeCategory(
  incoming: IncomingCategory,
  parentId: string | null,
  stored: StoredCategory | null,
): CategoryData {
  return {
    name: incoming.name,
    slug: incoming.slug,
    parentId,
    order: stored?.order ?? incoming.order ?? 0,
    isActive: stored?.isActive ?? incoming.isActive ?? true,
    image: stored?.image ?? '',
  };
}

/** O SKU e comparado sem espaço e sem caixa: e etiqueta, não identificador. */
export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

/** O texto do arquivo quando há texto; o do banco quando não há. */
function keepFilled(incoming: string | undefined, stored: string): string {
  return incoming !== undefined && incoming.trim().length > 0 ? incoming : stored;
}

/** A lista do arquivo quando ela traz algo; a do banco quando vem vazia. */
function keepFilledList(incoming: readonly string[] | undefined, stored: string[]): string[] {
  return incoming !== undefined && incoming.length > 0 ? [...incoming] : stored;
}
