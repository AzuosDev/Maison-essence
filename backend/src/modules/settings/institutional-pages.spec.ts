import { INSTITUTIONAL_PAGE_SLUGS } from '../../common/enums/institutional-page.js';
import {
  DEFAULT_INSTITUTIONAL_PAGES,
  defaultTitleOf,
  mergeInstitutionalPages,
  upsertPages,
} from './institutional-pages.js';

describe('mergeInstitutionalPages', () => {
  it('devolve as cinco páginas mesmo com o banco vazio', () => {
    const merged = mergeInstitutionalPages([]);

    expect(merged).toHaveLength(5);
    expect(merged.every((page) => page.content === '' && !page.isActive)).toBe(true);
  });

  it('mantem sempre a mesma ordem, independente da ordem gravada', () => {
    const merged = mergeInstitutionalPages([
      {
        slug: INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
        title: 'Privacidade',
        content: 'texto',
        isActive: true,
      },
    ]);

    expect(merged.map((page) => page.slug)).toEqual(
      DEFAULT_INSTITUTIONAL_PAGES.map((page) => page.slug),
    );
  });

  it('deixa o que foi gravado por cima do padrão', () => {
    const merged = mergeInstitutionalPages([
      {
        slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT,
        title: 'Nossa história',
        content: '## Ola',
        isActive: true,
      },
    ]);

    expect(merged[0]).toEqual({
      slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT,
      title: 'Nossa história',
      content: '## Ola',
      isActive: true,
    });
  });
});

describe('defaultTitleOf', () => {
  it('nomeia a página que a dona ainda não nomeou', () => {
    expect(defaultTitleOf(INSTITUTIONAL_PAGE_SLUGS.FAQ)).toBe('Perguntas frequentes');
  });
});

describe('upsertPages', () => {
  const gravada = {
    slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT,
    title: 'Quem somos',
    content: 'texto antigo',
    isActive: true,
  };

  it('atualiza só os campos citados', () => {
    const pages = upsertPages([gravada], [
      { slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, content: 'texto novo' },
    ]);

    expect(pages).toEqual([{ ...gravada, content: 'texto novo' }]);
  });

  it('cria a página que ainda não existia, com o título padrão', () => {
    const pages = upsertPages([], [{ slug: INSTITUTIONAL_PAGE_SLUGS.FAQ, content: '## Duvidas' }]);

    expect(pages).toEqual([
      {
        slug: INSTITUTIONAL_PAGE_SLUGS.FAQ,
        title: 'Perguntas frequentes',
        content: '## Duvidas',
        isActive: false,
      },
    ]);
  });

  it('não toca na página que o PATCH não citou', () => {
    const pages = upsertPages([gravada], [{ slug: INSTITUTIONAL_PAGE_SLUGS.PRIVACY, content: 'LGPD' }]);

    expect(pages[0]).toEqual(gravada);
  });

  it('não muda o array recebido', () => {
    const stored = [gravada];

    upsertPages(stored, [{ slug: INSTITUTIONAL_PAGE_SLUGS.ABOUT, title: 'Outro' }]);

    expect(stored[0].title).toBe('Quem somos');
  });
});
