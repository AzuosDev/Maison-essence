import { INSTITUTIONAL_PAGE_SLUGS } from '../../common/enums/institutional-page.js';
import type { InstitutionalPageSlug } from '../../common/enums/institutional-page.js';
import {
  ABOUT_CONTENT,
  FAQ_CONTENT,
  RETURNS_CONTENT,
  USAGE_CONTENT,
} from './institutional-content.js';

/**
 * As páginas institucionais que a loja tem.
 *
 * A lista e fechada e o slug nunca muda: o link do rodapé e o da Política de
 * Privacidade já estão no ar e vão parar em conversa de WhatsApp. O que a
 * dona edita e título, conteúdo e se a página esta publicada.
 *
 * As seis existem no painel desde o primeiro acesso, mesmo antes de alguém
 * escrever qualquer coisa: a tela precisa mostrar os seis formulários para
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
 * Título e texto iniciais de cada página, e a ordem em que o painel as lista.
 *
 * Quatro delas já nascem escritas e publicadas, com o texto que a dona
 * mandou: a apresentação da marca, o modo de uso, a política de trocas e as
 * perguntas frequentes (ver `institutional-content.ts`). São respostas que a
 * loja precisa dar na primeira visita — a aba "Trocas e devoluções" da página
 * do produto, por exemplo, só existe se a página existir —, e esperar que
 * alguém as digite no painel seria subir a loja muda justamente no que o
 * cliente pergunta antes de pagar.
 *
 * As outras duas nascem vazias e despublicadas, e e de propósito: página ativa
 * sem conteúdo vira link do rodapé que abre em branco, e um rodapé com "Como
 * comprar" vazio e pior do que um rodapé sem o link. Elas dependem de decisão
 * da loja — o passo a passo do pedido e o texto legal da privacidade —, então
 * quem escreve e publica e a dona.
 */
export const DEFAULT_INSTITUTIONAL_PAGES: readonly EditablePage[] = [
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT,
    title: 'Quem somos',
    content: ABOUT_CONTENT,
    isActive: true,
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY,
    title: 'Como comprar',
    content: '',
    isActive: false,
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.USAGE,
    title: 'Modo de uso',
    content: USAGE_CONTENT,
    isActive: true,
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.RETURNS,
    title: 'Trocas e devoluções',
    content: RETURNS_CONTENT,
    isActive: true,
  },
  {
    slug: INSTITUTIONAL_PAGE_SLUGS.FAQ,
    title: 'Perguntas frequentes',
    content: FAQ_CONTENT,
    isActive: true,
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
 * As seis páginas, com o que estiver gravado por cima dos padrões.
 *
 * Sempre na mesma ordem — a do painel, que vai do institucional ao legal — e
 * nunca na ordem em que os documentos foram criados, que e acidente de qual
 * página a dona escreveu primeiro.
 *
 * O que esta gravado vence campo por campo, e e isso que faz do texto deste
 * módulo um padrão e não uma trava: a dona reescreve "Quem somos" no painel e
 * a versão dela passa a valer, inclusive quando ela a esvazia ou despublica.
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
        // Nasce despublicada quando o PATCH não disse nada: o conteúdo que
        // chegou aqui e o que a dona acabou de escrever, e publicar e a
        // decisão seguinte dela. Ver DEFAULT_INSTITUTIONAL_PAGES.
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
