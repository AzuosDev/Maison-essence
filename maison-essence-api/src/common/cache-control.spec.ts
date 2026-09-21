import { CATALOG_CACHE, cacheControlOf } from './cache-control.js';

describe('cacheControlOf', () => {
  it('deixa a CDN guardar e o navegador revalidar', () => {
    expect(cacheControlOf(CATALOG_CACHE)).toBe(
      'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    );
  });

  it('usa os segundos que receber', () => {
    expect(cacheControlOf({ sMaxAge: 300, staleWhileRevalidate: 600 })).toContain(
      's-maxage=300, stale-while-revalidate=600',
    );
  });
});
