import { queryFlagOf } from './query-flag.js';

/**
 * A bandeira da query string.
 *
 * Uma query string so carrega texto, e as tres formas abaixo chegam das tres
 * bibliotecas de front que montam link no projeto. O que nao e reconhecido
 * precisa passar intacto para o `@IsBoolean` do campo recusar com a mensagem
 * dele — devolver `false` aqui viraria um filtro silencioso.
 */
describe('queryFlagOf', () => {
  it('le as três formas de dizer sim', () => {
    // `?readyToShip` sem valor e o que um `<a href="?readyToShip">` produz.
    expect(queryFlagOf('')).toBe(true);
    expect(queryFlagOf('true')).toBe(true);
    expect(queryFlagOf('1')).toBe(true);
  });

  it('le as duas formas de dizer não', () => {
    expect(queryFlagOf('false')).toBe(false);
    expect(queryFlagOf('0')).toBe(false);
  });

  it('deixa o resto passar, para o campo recusar com a mensagem dele', () => {
    expect(queryFlagOf('talvez')).toBe('talvez');
    expect(queryFlagOf(undefined)).toBeUndefined();
  });
});
