import { INSTITUTIONAL_PAGE_SLUGS } from '../../common/enums/institutional-page.js';
import {
  DEFAULT_INSTITUTIONAL_PAGES,
  defaultTitleOf,
  mergeInstitutionalPages,
  upsertPages,
} from './institutional-pages.js';

describe('mergeInstitutionalPages', () => {
  it('devolve as seis páginas mesmo com o banco vazio', () => {
    const merged = mergeInstitutionalPages([]);

    expect(merged).toHaveLength(6);
  });

  it('entrega as seis escritas e publicadas, sem banco nenhum', () => {
    const merged = mergeInstitutionalPages([]);

    expect(merged.map((page) => page.slug)).toEqual([
      INSTITUTIONAL_PAGE_SLUGS.ABOUT,
      INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY,
      INSTITUTIONAL_PAGE_SLUGS.USAGE,
      INSTITUTIONAL_PAGE_SLUGS.RETURNS,
      INSTITUTIONAL_PAGE_SLUGS.FAQ,
      INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
    ]);
    expect(merged.every((page) => page.content !== '')).toBe(true);
    expect(merged.every((page) => page.isActive)).toBe(true);
  });

  /**
   * O defeito que estava no ar em 29/10/2026.
   *
   * Quatro páginas tinham sido salvas em branco antes de este módulo ter
   * texto para elas. Com o vazio gravado vencendo, publicar o texto de
   * fábrica não mudava nada: os links do menu e do rodapé continuavam
   * abrindo uma página em branco.
   */
  it('o texto de fábrica responde pela página salva em branco', () => {
    const merged = mergeInstitutionalPages([
      {
        slug: INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
        title: 'Política de privacidade',
        content: '   ',
        isActive: true,
      },
    ]);
    const privacidade = merged.find((page) => page.slug === INSTITUTIONAL_PAGE_SLUGS.PRIVACY);

    expect(privacidade?.content).toContain('Quais dados pedimos');
  });

  /**
   * Despublicar continua sendo o jeito de tirar uma página do ar.
   *
   * E o que impede a exceção acima de virar uma trava: o texto de fábrica
   * responde pelo vazio, mas quem decide se a página existe no site continua
   * sendo a dona, pelo `isActive`.
   */
  it('a página despublicada no painel continua despublicada', () => {
    const merged = mergeInstitutionalPages([
      {
        slug: INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
        title: 'Política de privacidade',
        content: '',
        isActive: false,
      },
    ]);
    const privacidade = merged.find((page) => page.slug === INSTITUTIONAL_PAGE_SLUGS.PRIVACY);

    expect(privacidade?.isActive).toBe(false);
  });

  /** O texto escrito pela dona continua vencendo o de fábrica. */
  it('deixa o que foi escrito no painel por cima do padrão', () => {
    const merged = mergeInstitutionalPages([
      {
        slug: INSTITUTIONAL_PAGE_SLUGS.PRIVACY,
        title: 'Privacidade',
        content: 'O que a dona escreveu.',
        isActive: true,
      },
    ]);
    const privacidade = merged.find((page) => page.slug === INSTITUTIONAL_PAGE_SLUGS.PRIVACY);

    expect(privacidade?.content).toBe('O que a dona escreveu.');
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
