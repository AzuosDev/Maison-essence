import { INSTITUTIONAL_PAGE_SLUGS } from '../../common/enums/institutional-page.js';
import type { InstitutionalPageSlug } from '../../common/enums/institutional-page.js';

/**
 * As paginas institucionais que a loja tem.
 *
 * A lista e fechada e o slug nunca muda: o link do rodape e o da Politica de
 * Privacidade ja estao no ar e vao parar em conversa de WhatsApp. O que a
 * dona edita e titulo, conteudo e se a pagina esta publicada.
 *
 * As cinco existem no painel desde o primeiro acesso, mesmo antes de alguem
 * escrever qualquer coisa: a tela precisa mostrar os cinco formularios para
 * que a dona saiba o que falta. No banco, so vao parar as que ela gravar.
 */

/** Uma pagina como o painel a edita. */
export interface EditablePage {
  slug: InstitutionalPageSlug;
  title: string;
  /** Markdown, do jeito que foi escrito. O frontend renderiza. */
  content: string;
  isActive: boolean;
}

/**
 * Titulo inicial de cada pagina e a ordem em que o painel as lista.
 *
 * Todas nascem despublicadas (`isActive: false`) de proposito: pagina ativa
 * sem conteudo vira link do rodape que abre em branco, e um rodape com "Trocas
 * e devolucoes" vazio e pior do que um rodape sem o link. A dona escreve e
 * publica.
 */
export const DEFAULT_INSTITUTIONAL_PAGES: readonly EditablePage[] = [
  { slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, title: 'Quem somos', content: '', isActive: false },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY,
    title: 'Como comprar',
    content: '',
    isActive: false,
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.RETURNS,
    title: 'Trocas e devoluções',
    content: '',
    isActive: false,
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.FAQ,
    title: 'Perguntas frequentes',
    content: '',
    isActive: false,
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
    title: 'Política de privacidade',
    content: '',
    isActive: false,
  },
];

/** Titulo padrao de uma pagina que a dona ainda nao nomeou. */
export function defaultTitleOf(slug: InstitutionalPageSlug): string {
  return DEFAULT_INSTITUTIONAL_PAGES.find((page) => page.slug === slug)?.title ?? slug;
}

/**
 * As cinco paginas, com o que estiver gravado por cima dos padroes.
 *
 * Sempre na mesma ordem — a do painel, que vai do institucional ao legal — e
 * nunca na ordem em que os documentos foram criados, que e acidente de qual
 * pagina a dona escreveu primeiro.
 */
export function mergeInstitutionalPages(stored: readonly EditablePage[]): EditablePage[] {
  const bySlug = new Map(stored.map((page) => [page.slug, page]));

  return DEFAULT_INSTITUTIONAL_PAGES.map((fallback) => {
    const saved = bySlug.get(fallback.slug);

    return saved ? { ...fallback, ...saved } : { ...fallback };
  });
}

/** O que o PATCH manda para uma pagina. So o slug e obrigatorio. */
export interface PageUpdate {
  slug: InstitutionalPageSlug;
  title?: string;
  content?: string;
  isActive?: boolean;
}

/**
 * Aplica as edicoes recebidas sobre o que esta gravado.
 *
 * Pagina citada e atualizada campo a campo; pagina ainda nao gravada nasce
 * aqui, com o titulo padrao quando a dona nao escolheu um. Pagina que nao veio
 * no PATCH nao e tocada — o painel edita uma pagina por vez, e mandar o array
 * inteiro so para mexer no "Quem somos" seria pedir para sobrescrever o que
 * outra aba abriu.
 */
export function upsertPages(
  stored: readonly EditablePage[],
  updates: readonly PageUpdate[],
): EditablePage[] {
  const pages = stored.map((page) => ({ ...page }));

  for (const update of updates) {
    const existing = pages.find((page) => page.slug === update.slug);

    if (!existing) {
      pages.push({
        slug: update.slug,
        title: update.title ?? defaultTitleOf(update.slug),
        content: update.content ?? '',
        // Nasce despublicada quando o PATCH nao disse nada: ver o comentario
        // de DEFAULT_INSTITUTIONAL_PAGES.
        isActive: update.isActive ?? false,
      });
      continue;
    }

    if (update.title !== undefined) {
      existing.title = update.title;
    }

    if (update.content !== undefined) {
      existing.content = update.content;
    }

    if (update.isActive !== undefined) {
      existing.isActive = update.isActive;
    }
  }

  return pages;
}
