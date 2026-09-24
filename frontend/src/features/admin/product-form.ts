import { centsFromInput, centsToInput } from '@/lib/format';
import {
  PRODUCT_LIMITS,
  type AdminProduct,
  type AdminVariantInput,
  type CreateProductInput,
  type UpdateProductInput,
} from './admin.types';

/**
 * O cadastro do produto enquanto esta sendo editado.
 *
 * ## Por que existe um "rascunho" e nao o proprio `AdminProduct`
 *
 * Porque a tela e o banco discordam sobre o que e um preco. No banco e um
 * inteiro em centavos; na tela e o texto que a dona esta digitando, e no meio
 * do caminho ele passa por `1`, `19`, `199,` e `199,9` — nenhum dos quais e
 * um preco valido. Um modelo que so aceita numeros obrigaria a tela a
 * adivinhar o que fazer com os estados intermediarios, e o jeito comum de
 * adivinhar e apagar o que a pessoa digitou.
 *
 * Entao o rascunho guarda **texto** nos campos numericos, e a conversao
 * acontece uma vez, na saida, depois que a validacao passou.
 *
 * ## A chave de linha nao e o id
 *
 * Cada variante carrega uma `key` que existe so aqui dentro. Uma variante
 * nova nao tem id ate o servidor responder, e usar o indice do array como
 * chave do React faria a linha 2 herdar o estado da linha 3 quando a 1 fosse
 * removida — o campo de preco com o valor do vizinho, que e o tipo de
 * defeito que so aparece depois de publicado.
 *
 * ## Tudo aqui e funcao pura
 *
 * E a parte que erra em silencio: um preco lido errado entra no banco um
 * centavo mais barato, uma variante duplicada rouba o SKU da original, uma
 * imagem reordenada troca a capa sem avisar. Nada disso precisa de uma tela
 * montada para ser testado.
 */

/* ---- O modelo ------------------------------------------------------------ */

export interface VariantDraft {
  /** Chave estavel de linha. Existe so na tela; nunca viaja para a API. */
  key: string;
  /** Presente: variante que ja existe. Ausente: o servidor vai cria-la. */
  id?: string;
  sku: string;
  label: string;
  /** Como esta digitado: `199,90`. Vira centavos na saida. */
  price: string;
  /** O preco "de", riscado no card. Vazio tira o desconto. */
  compareAtPrice: string;
  stock: string;
  image: string;
  isActive: boolean;
  /** Deixa vender com estoque zerado: o que a dona encomenda sob demanda. */
  allowBackorder: boolean;
}

export interface ProductDraft {
  name: string;
  /** So na criacao. A edicao nao mexe no endereco — ver `UpdateProductInput`. */
  slug: string;
  description: string;
  brand: string;
  categoryIds: string[];
  /** `publicId`s na ordem de exibicao. A primeira e a capa. */
  images: string[];
  variants: VariantDraft[];
  isActive: boolean;
  isFeatured: boolean;
  isReadyToShip: boolean;
  tags: string[];
}

/** Onde os erros aparecem: por campo do produto e por chave de variante. */
export interface DraftErrors {
  name?: string;
  slug?: string;
  description?: string;
  brand?: string;
  images?: string;
  /** Um recado sobre a lista inteira: "todo produto precisa de uma variante". */
  variants?: string;
  /** Por `key` de linha, e depois por campo dentro dela. */
  variant: Record<string, { label?: string; sku?: string; price?: string; stock?: string }>;
}

/* ---- Comecar ------------------------------------------------------------- */

let keySeed = 0;

/**
 * Uma chave de linha nova.
 *
 * Contador, e nao `crypto.randomUUID()`: a chave nunca sai desta aba e nao
 * precisa ser unica no mundo — precisa ser unica nesta lista e estavel entre
 * renders. Um contador cumpre as duas e sobrevive a ambientes sem `crypto`.
 */
function nextKey(): string {
  keySeed += 1;

  return `v${String(keySeed)}`;
}

/** Uma linha de variante em branco, ativa e sem estoque. */
export function newVariant(): VariantDraft {
  return {
    key: nextKey(),
    sku: '',
    label: '',
    price: '',
    compareAtPrice: '',
    stock: '0',
    image: '',
    isActive: true,
    allowBackorder: false,
  };
}

/**
 * Um produto novo, ja com uma linha de variante.
 *
 * Nao e conveniencia: produto sem variante nao existe no dominio, e o
 * servidor recusa com 422. Abrir o formulario com a tabela de variantes vazia
 * ensinaria a dona a salvar e so entao descobrir que falta algo.
 */
export function emptyProductDraft(): ProductDraft {
  return {
    name: '',
    slug: '',
    description: '',
    brand: '',
    categoryIds: [],
    images: [],
    variants: [newVariant()],
    isActive: true,
    isFeatured: false,
    isReadyToShip: false,
    tags: [],
  };
}

/** O cadastro salvo, aberto para edicao. */
export function draftFromProduct(product: AdminProduct): ProductDraft {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    categoryIds: [...product.categoryIds],
    images: [...product.images],
    variants: product.variants.map((variant) => ({
      key: nextKey(),
      id: variant.id,
      sku: variant.sku,
      label: variant.label,
      price: centsToInput(variant.priceCents),
      // `null` e "nao ha preco de comparacao", e vira campo vazio — e nao
      // `0,00`, que seria um desconto de 100%.
      compareAtPrice:
        variant.compareAtPriceCents === null ? '' : centsToInput(variant.compareAtPriceCents),
      stock: String(variant.stock),
      image: variant.image,
      isActive: variant.isActive,
      allowBackorder: variant.allowBackorder,
    })),
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isReadyToShip: product.isReadyToShip,
    tags: [...product.tags],
  };
}

/**
 * Duplica uma linha de variante.
 *
 * O que se repete e o trabalho: preco, preco de comparacao, estoque e as duas
 * chaves. O que **nao** se repete e a identidade — `id` e `sku` saem fora,
 * porque sao unicos por variante e copia-los faria a linha nova sobrescrever
 * a original ao salvar.
 *
 * O `label` fica como esta, de proposito. Quem duplica esta prestes a
 * escrever "50 ml" onde estava "100 ml", e apagar o campo tiraria a
 * referencia do que ela esta copiando. Duas linhas com o mesmo label sao
 * barradas pela validacao, entao o esquecimento nao chega ao servidor.
 */
export function duplicateVariant(variant: VariantDraft): VariantDraft {
  // O `id` e retirado, e nao zerado: com `exactOptionalPropertyTypes`, um
  // campo opcional presente valendo `undefined` nao e a mesma coisa que um
  // campo ausente — e e a ausencia que faz o servidor criar uma variante nova.
  const { id: _existing, ...rest } = variant;

  return { ...rest, key: nextKey(), sku: '' };
}

/* ---- As imagens ----------------------------------------------------------- */

/**
 * Move uma foto de posicao.
 *
 * A ordem do array **e** a ordem de exibicao, e a primeira posicao e a capa —
 * nao ha campo separado para ela. Por isso arrastar a terceira foto para o
 * inicio e o gesto que define a capa, e por isso `setCover` abaixo e apenas
 * este mesmo movimento com um nome que diz o que ele significa.
 */
export function moveImage(images: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) {
    return [...images];
  }

  const next = [...images];
  const [moved] = next.splice(from, 1);

  if (moved !== undefined) {
    next.splice(to, 0, moved);
  }

  return next;
}

/** Promove a foto a capa, que e dizer: leva para a primeira posicao. */
export function setCover(images: readonly string[], index: number): string[] {
  return moveImage(images, index, 0);
}

export function removeImage(images: readonly string[], index: number): string[] {
  return images.filter((_, position) => position !== index);
}

/* ---- A validacao ----------------------------------------------------------- */

/**
 * O que impede o cadastro de sair.
 *
 * Confere o que o servidor conferiria, e nao mais do que isso: a tela que
 * inventa regra propria acaba recusando um cadastro que a API aceitaria, e
 * quem esta do outro lado nao tem como saber qual das duas esta errada.
 *
 * As duas checagens que **nao** sao copia do servidor sao as de repetido —
 * dois labels iguais, dois SKUs iguais. O servidor as trata de outro jeito
 * (gera sufixo, ou recusa com 409 depois de meio salvamento), e nenhum dos
 * dois desfechos e o que a dona espera de duas linhas identicas na frente
 * dela.
 */
export function validateDraft(draft: ProductDraft): DraftErrors {
  const errors: DraftErrors = { variant: {} };

  if (draft.name.trim().length < 2) {
    errors.name = 'O nome precisa de ao menos duas letras.';
  } else if (draft.name.length > PRODUCT_LIMITS.name) {
    errors.name = `O nome passa de ${String(PRODUCT_LIMITS.name)} caracteres.`;
  }

  if (draft.brand.length > PRODUCT_LIMITS.brand) {
    errors.brand = `A marca passa de ${String(PRODUCT_LIMITS.brand)} caracteres.`;
  }

  if (draft.description.length > PRODUCT_LIMITS.description) {
    errors.description = `A descrição passa de ${String(PRODUCT_LIMITS.description)} caracteres.`;
  }

  if (draft.images.length > PRODUCT_LIMITS.images) {
    errors.images = `São no máximo ${String(PRODUCT_LIMITS.images)} fotos por produto.`;
  }

  if (draft.variants.length === 0) {
    errors.variants = 'Todo produto precisa de ao menos uma variante, mesmo que sem nome.';
  } else if (draft.variants.length > PRODUCT_LIMITS.variants) {
    errors.variants = `São no máximo ${String(PRODUCT_LIMITS.variants)} variantes.`;
  }

  const labels = new Map<string, number>();
  const skus = new Map<string, number>();

  for (const variant of draft.variants) {
    const line: { label?: string; sku?: string; price?: string; stock?: string } = {};

    const cents = centsFromInput(variant.price);

    if (cents === null) {
      line.price = 'Escreva o preço, como 199,90.';
    } else if (cents < 0) {
      line.price = 'O preço não pode ser negativo.';
    } else if (cents > PRODUCT_LIMITS.priceCents) {
      line.price = 'Esse preço passa do limite do sistema.';
    }

    if (variant.compareAtPrice.trim() !== '') {
      const compare = centsFromInput(variant.compareAtPrice);

      if (compare === null) {
        line.price = line.price ?? 'O preço de comparação não e um número.';
      } else if (cents !== null && compare <= cents) {
        // Um "de" menor que o "por" desenha um desconto negativo no card.
        line.price = line.price ?? 'O preço de comparação precisa ser maior que o preço.';
      }
    }

    const stock = Number.parseInt(variant.stock, 10);

    if (variant.stock.trim() === '' || !Number.isInteger(stock) || stock < 0) {
      line.stock = 'Escreva quantas unidades há, ou zero.';
    } else if (stock > PRODUCT_LIMITS.stock) {
      line.stock = 'Esse estoque passa do limite do sistema.';
    }

    if (variant.label.length > PRODUCT_LIMITS.variantLabel) {
      line.label = `O nome da variante passa de ${String(PRODUCT_LIMITS.variantLabel)} caracteres.`;
    }

    if (variant.sku.length > PRODUCT_LIMITS.sku) {
      line.sku = `O SKU passa de ${String(PRODUCT_LIMITS.sku)} caracteres.`;
    }

    const label = normalizeLabel(variant.label);
    const sku = variant.sku.trim().toUpperCase();

    labels.set(label, (labels.get(label) ?? 0) + 1);

    if (sku !== '') {
      skus.set(sku, (skus.get(sku) ?? 0) + 1);
    }

    if (Object.keys(line).length > 0) {
      errors.variant[variant.key] = line;
    }
  }

  // A segunda passada marca os repetidos. E preciso conhecer a lista inteira
  // antes de dizer que uma linha esta repetida — na primeira passada, a
  // primeira ocorrencia ainda parece unica.
  for (const variant of draft.variants) {
    const label = normalizeLabel(variant.label);
    const sku = variant.sku.trim().toUpperCase();
    const line = errors.variant[variant.key] ?? {};

    if ((labels.get(label) ?? 0) > 1) {
      line.label = 'Duas variantes com o mesmo nome. Diferencie uma delas.';
    }

    if (sku !== '' && (skus.get(sku) ?? 0) > 1) {
      line.sku = 'Esse SKU esta repetido em outra variante.';
    }

    if (Object.keys(line).length > 0) {
      errors.variant[variant.key] = line;
    }
  }

  return errors;
}

/**
 * O nome da variante como quem le a vitrine o entende.
 *
 * Caixa e espaco nao diferenciam variante nenhuma: "100ml", "100 ML" e
 * " 100 ml " sao o mesmo frasco para quem compra, e duas linhas assim sao
 * sempre a mesma duplicacao esquecida — alguem copiou a linha e mudou so o
 * jeito de escrever. O espaco sai por inteiro, e nao e apenas colapsado:
 * "100 ml" ao lado de "100ml" e o caso que esta checagem existe para pegar.
 *
 * O valor daqui so serve para comparar. O que e salvo continua sendo o que a
 * dona escreveu, com os espacos dela.
 *
 * Nao vale para o SKU: la a normalizacao e a do servidor — apara e
 * maiusculiza —, e um espaco no meio de um codigo de estoque e uma diferenca
 * de verdade.
 */
function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '');
}

/** Ha algo impedindo o salvamento. */
export function hasErrors(errors: DraftErrors): boolean {
  const fields = [
    errors.name,
    errors.slug,
    errors.description,
    errors.brand,
    errors.images,
    errors.variants,
  ];

  return fields.some((message) => message !== undefined) || Object.keys(errors.variant).length > 0;
}

/* ---- A saida ---------------------------------------------------------------- */

/**
 * O corpo do `POST`.
 *
 * O `slug` so entra quando foi escrito: omitido, o servidor o gera a partir
 * do nome, que e o caminho normal. Mandar string vazia seria diferente de
 * omitir — o validador a recusaria.
 */
export function draftToCreate(draft: ProductDraft): CreateProductInput {
  const slug = draft.slug.trim();

  return {
    ...draftToUpdate(draft),
    name: draft.name.trim(),
    ...(slug === '' ? {} : { slug }),
  };
}

/**
 * O corpo do `PATCH`.
 *
 * O array de variantes vai inteiro, e e essa a razao de a tela nunca mostrar
 * uma variante que ela nao mandaria de volta: o que sumir daqui e removido ou
 * aposentado do lado de la.
 */
export function draftToUpdate(draft: ProductDraft): UpdateProductInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    brand: draft.brand.trim(),
    categoryIds: [...draft.categoryIds],
    images: [...draft.images],
    variants: draft.variants.map(variantToInput),
    isActive: draft.isActive,
    isFeatured: draft.isFeatured,
    isReadyToShip: draft.isReadyToShip,
    tags: draft.tags.map((tag) => tag.trim()).filter((tag) => tag !== ''),
  };
}

function variantToInput(variant: VariantDraft): AdminVariantInput {
  const compare =
    variant.compareAtPrice.trim() === '' ? null : centsFromInput(variant.compareAtPrice);

  return {
    // Os tres campos opcionais so entram quando tem valor. O `sku` vazio faz
    // o servidor gerar um; o `id` ausente faz o servidor criar a variante.
    ...(variant.id === undefined ? {} : { id: variant.id }),
    ...(variant.sku.trim() === '' ? {} : { sku: variant.sku.trim() }),
    label: variant.label.trim(),
    // A validacao ja passou, entao `centsFromInput` nao devolve `null` aqui.
    // O `?? 0` existe para o tipo, e nao para o caso.
    priceCents: centsFromInput(variant.price) ?? 0,
    compareAtPriceCents: compare,
    stock: Number.parseInt(variant.stock, 10) || 0,
    image: variant.image,
    isActive: variant.isActive,
    allowBackorder: variant.allowBackorder,
  };
}
