import { hasValidWindow, isBannerLive, liveBanners, unknownBannerIds } from './banners.js';
import type { ScheduledBanner } from './banners.js';

const NOW = new Date('2026-09-20T12:00:00.000Z');

function banner(overrides: Partial<ScheduledBanner> = {}): ScheduledBanner {
  return { order: 0, isActive: true, startsAt: null, endsAt: null, ...overrides };
}

describe('isBannerLive', () => {
  it('exibe o banner sem periodo definido', () => {
    expect(isBannerLive(banner(), NOW)).toBe(true);
  });

  it('nao exibe banner cuja data de fim ja passou', () => {
    expect(isBannerLive(banner({ endsAt: new Date('2026-09-19T23:59:59.000Z') }), NOW)).toBe(
      false,
    );
  });

  it('nao exibe banner que ainda vai comecar', () => {
    expect(isBannerLive(banner({ startsAt: new Date('2026-12-01T00:00:00.000Z') }), NOW)).toBe(
      false,
    );
  });

  it('exibe banner dentro do periodo', () => {
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

  it('nao exibe banner desligado na mao, mesmo dentro do periodo', () => {
    expect(isBannerLive(banner({ isActive: false }), NOW)).toBe(false);
  });
});

describe('liveBanners', () => {
  it('devolve so os vigentes, na ordem escolhida', () => {
    const banners = [
      banner({ order: 2 }),
      banner({ order: 0, endsAt: new Date('2026-01-01T00:00:00.000Z') }),
      banner({ order: 1 }),
    ];

    expect(liveBanners(banners, NOW).map((item) => item.order)).toEqual([1, 2]);
  });
});

describe('hasValidWindow', () => {
  it('aceita periodo com uma ponta aberta', () => {
    expect(hasValidWindow({ startsAt: NOW, endsAt: null })).toBe(true);
    expect(hasValidWindow({ startsAt: null, endsAt: NOW })).toBe(true);
  });

  it('recusa fim anterior ou igual ao inicio', () => {
    expect(
      hasValidWindow({ startsAt: NOW, endsAt: new Date('2026-09-19T00:00:00.000Z') }),
    ).toBe(false);
    expect(hasValidWindow({ startsAt: NOW, endsAt: NOW })).toBe(false);
  });
});

describe('unknownBannerIds', () => {
  it('aponta o id que nao existe mais', () => {
    const incoming = [{ id: 'aaa' }, {}, { id: 'ccc' }];

    expect(unknownBannerIds(incoming, ['aaa', 'bbb'])).toEqual(['ccc']);
  });

  it('nao reclama de banner novo, que vem sem id', () => {
    expect(unknownBannerIds([{}, {}], [])).toEqual([]);
  });
});
