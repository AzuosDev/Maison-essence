import { CATALOG_CACHE, SETTINGS_CACHE, cacheControlOf } from './cache-control.js';

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

  /*
   * A janela das configurações e curta de propósito, e o número esta preso
   * aqui.
   *
   * E a resposta que desenha a moldura de toda página, e também a que a dona
   * edita no painel esperando ver o resultado. Quando ela era de cinco
   * minutos, trocar um banner de vaga parecia não ter gravado: a borda servia
   * a home de antes sem perguntar nada a esta função. Se alguém aumentar isto
   * de novo para economizar invocação, que seja com este teste na frente.
   */
  it('mantém as configurações com janela curta, porque a dona as edita', () => {
    expect(SETTINGS_CACHE.sMaxAge).toBeLessThanOrEqual(30);
    expect(SETTINGS_CACHE.sMaxAge + SETTINGS_CACHE.staleWhileRevalidate).toBeLessThanOrEqual(120);
  });
});
