import { hasValidWindow, isBannerLive, liveBanners, unknownBannerIds } from './banners.js';
import type { ScheduledBanner } from './banners.js';

const NOW = new Date('2026-09-20T12:00:00.000Z');

function banner(overrides: Partial<ScheduledBanner> = {}): ScheduledBanner {
  return { order: 0, isActive: true, startsAt: null, endsAt: null, ...overrides };
}

describe('isBannerLive', () => {
  it('exibe o banner sem período definido', () => {
    expect(isBannerLive(banner(), NOW)).toBe(true);
  });

  it('não exibe banner cuja data de fim já passou', () => {
    expect(isBannerLive(banner({ endsAt: new Date('2026-09-19T23:59:59.000Z') }), NOW)).toBe(
      false,
    );
  });

  it('não exibe banner que ainda vai começar', () => {
    expect(isBannerLive(banner({ startsAt: new Date('2026-12-01T00:00:00.000Z') }), NOW)).toBe(
      false,
    );
  });

  it('exibe banner dentro do período', () => {
    const agendado = banner({
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    expect(isBannerLive(agendado, NOW)).toBe(true);
  });

  it('trata o fim como o instante em que o banner sai do ar', () => {
    expect(isBannerLive(banner({ endsAt: NOW }), NOW)).toBe(false);
    expect(isBannerLive(banner({ startsAt: NOW }), NOW)).toBe(true);
  });

  it('não exibe banner desligado na mão, mesmo dentro do período', () => {
    expect(isBannerLive(banner({ isActive: false }), NOW)).toBe(false);
  });
});

describe('liveBanners', () => {
  it('devolve só os vigentes, na ordem escolhida', () => {
    const banners = [
      banner({ order: 2 }),
      banner({ order: 0, endsAt: new Date('2026-01-01T00:00:00.000Z') }),
      banner({ order: 1 }),
    ];

    expect(liveBanners(banners, NOW).map((item) => item.order)).toEqual([1, 2]);
  });
});

describe('hasValidWindow', () => {
  it('aceita período com uma ponta aberta', () => {
    expect(hasValidWindow({ startsAt: NOW, endsAt: null })).toBe(true);
    expect(hasValidWindow({ startsAt: null, endsAt: NOW })).toBe(true);
  });

  it('recusa fim anterior ou igual ao início', () => {
    expect(
      hasValidWindow({ startsAt: NOW, endsAt: new Date('2026-09-19T00:00:00.000Z') }),
    ).toBe(false);
    expect(hasValidWindow({ startsAt: NOW, endsAt: NOW })).toBe(false);
  });
});

describe('unknownBannerIds', () => {
  it('aponta o id que não existe mais', () => {
    const incoming = [{ id: 'aaa' }, {}, { id: 'ccc' }];

    expect(unknownBannerIds(incoming, ['aaa', 'bbb'])).toEqual(['ccc']);
  });

  it('não reclama de banner novo, que vem sem id', () => {
    expect(unknownBannerIds([{}, {}], [])).toEqual([]);
  });
});
