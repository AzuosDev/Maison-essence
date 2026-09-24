import { INSTITUTIONAL_PAGE_SLUGS } from '../../common/enums/institutional-page.js';
import type { InstitutionalPageSlug } from '../../common/enums/institutional-page.js';

/**
 * As páginas institucionais que a loja tem.
 *
 * A lista e fechada e o slug nunca muda: o link do rodapé e o da Política de
 * Privacidade já estão no ar e vão parar em conversa de WhatsApp. O que a
 * dona edita e título, conteúdo e se a página esta publicada.
 *
 * As cinco existem no painel desde o primeiro acesso, mesmo antes de alguém
 * escrever qualquer coisa: a tela precisa mostrar os cinco formulários para
 * que a dona saiba o que falta. No banco, só vão parar as que ela gravar.
 */

/** Uma página como o painel a edita. */
export interface EditablePage {
  slug: InstitutionalPageSlug;
  title: string;
  /** Markdown, do jeito que foi escrito. O frontend renderiza. */
  content: string;
  isActive: boolean;
}

/**
 * Título inicial de cada página e a ordem em que o painel as lista.
 *
 * Todas nascem despublicadas (`isActive: false`) de propósito: página ativa
 * sem conteúdo vira link do rodapé que abre em branco, e um rodapé com "Trocas
 * e devoluções" vazio e pior do que um rodapé sem o link. A dona escreve e
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

/** Título padrão de uma página que a dona ainda não nomeou. */
export function defaultTitleOf(slug: InstitutionalPageSlug): string {
  return DEFAULT_INSTITUTIONAL_PAGES.find((page) => page.slug === slug)?.title ?? slug;
}

/**
 * As cinco páginas, com o que estiver gravado por cima dos padrões.
 *
 * Sempre na mesma ordem — a do painel, que vai do institucional ao legal — e
 * nunca na ordem em que os documentos foram criados, que e acidente de qual
 * página a dona escreveu primeiro.
 */
export function mergeInstitutionalPages(stored: readonly EditablePage[]): EditablePage[] {
  const bySlug = new Map(stored.map((page) => [page.slug, page]));

  return DEFAULT_INSTITUTIONAL_PAGES.map((fallback) => {
    const saved = bySlug.get(fallback.slug);

    return saved ? { ...fallback, ...saved } : { ...fallback };
  });
}

/** O que o PATCH manda para uma página. Só o slug e obrigatório. */
export interface PageUpdate {
  slug: InstitutionalPageSlug;
  title?: string;
  content?: string;
  isActive?: boolean;
}

/**
 * Aplica as edições recebidas sobre o que esta gravado.
 *
 * Página citada e atualizada campo a campo; página ainda não gravada nasce
 * aqui, com o título padrão quando a dona não escolheu um. Página que não veio
 * no PATCH não e tocada — o painel edita uma página por vez, e mandar o array
 * inteiro só para mexer no "Quem somos" seria pedir para sobrescrever o que
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
        // Nasce despublicada quando o PATCH não disse nada: ver o comentário
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
