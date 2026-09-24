import type { Document, Schema } from 'mongoose';

export const MAX_SLUG_LENGTH = 120;

/** Quantos sufixos numericos tentar antes de desistir e sortear um. */
const MAX_SLUG_ATTEMPTS = 50;

/**
 * Converte um nome em slug: minúsculas, sem acento, separado por hífen.
 *
 * `Perfume Árabe 100ml` vira `perfume-arabe-100ml`. A normalização NFD separa
 * a letra do acento e o range unicode remove só os acentos, preservando o
 * resto — e por isso `ç` vira `c` e não some.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/**
 * Preenche o `slug` a partir de outro campo, uma única vez, garantindo que
 * nenhum outro documento da coleção já o tenha.
 *
 * Só gera quando o slug esta vazio. Renomear o produto depois não mexe no
 * endereço dele: o link já foi para o WhatsApp de alguém e precisa continuar
 * abrindo. Trocar de slug de propósito e uma operação separada, do painel,
 * que guarda o antigo em `previousSlugs`.
 */
/** O mínimo que o hook precisa enxergar do documento que esta salvando. */
interface SluggableDocument extends Document {
  slug: string;
}

export function applySlugFrom<T extends { slug: string }>(
  schema: Schema<T>,
  sourcePath: keyof T & string,
): void {
  schema.pre<SluggableDocument>('validate', async function () {
    if (typeof this.slug === 'string' && this.slug.length > 0) {
      return;
    }

    const source: unknown = this.get(sourcePath);

    if (typeof source !== 'string' || source.trim().length === 0) {
      return;
    }

    const base = slugify(source);

    if (base.length === 0) {
      return;
    }

    // Consulta pelo driver nativo em vez do model: e uma leitura simples, não
    // precisa passar pelos middlewares do próprio schema que estamos rodando.
    const ownId = String(this._id);
    const isTaken = async (candidate: string): Promise<boolean> => {
      const found = await this.collection.findOne(
        { slug: candidate },
        { projection: { _id: 1 } },
      );

      // Comparar com o próprio id importa no update: reprocessar um documento
      // que já tem o slug não pode fazer dele um homonimo de si mesmo.
      return found !== null && String(found._id) !== ownId;
    };

    this.slug = await resolveAvailable(base, isTaken);
  });
}

async function resolveAvailable(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) {
    return base;
  }

  for (let suffix = 2; suffix <= MAX_SLUG_ATTEMPTS; suffix += 1) {
    const candidate = withSuffix(base, String(suffix));

    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  // Cinquenta homonimos na mesma coleção não e um caso real; se acontecer, um
  // sufixo aleatório resolve sem deixar o save travado num laço.
  return withSuffix(base, Math.random().toString(36).slice(2, 8));
}

/** Corta a base para o sufixo caber dentro do tamanho máximo do slug. */
function withSuffix(base: string, suffix: string): string {
  const room = MAX_SLUG_LENGTH - suffix.length - 1;

  return `${base.slice(0, room).replace(/-+$/g, '')}-${suffix}`;
}
