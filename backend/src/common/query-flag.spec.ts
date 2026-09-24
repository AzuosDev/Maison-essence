import { queryFlagOf } from './query-flag.js';

/**
 * A bandeira da query string.
 *
 * Uma query string só carrega texto, e as três formas abaixo chegam das três
 * bibliotecas de front que montam link no projeto. O que não e reconhecido
 * precisa passar intacto para o `@IsBoolean` do campo recusar com a mensagem
 * dele — devolver `false` aqui viraria um filtro silencioso.
 */
describe('queryFlagOf', () => {
  it('lê as três formas de dizer sim', () => {
    // `?readyToShip` sem valor e o que um `<a href="?readyToShip">` produz.
    expect(queryFlagOf('')).toBe(true);
    expect(queryFlagOf('true')).toBe(true);
    expect(queryFlagOf('1')).toBe(true);
  });

  it('lê as duas formas de dizer não', () => {
    expect(queryFlagOf('false')).toBe(false);
    expect(queryFlagOf('0')).toBe(false);
  });

  it('deixa o resto passar, para o campo recusar com a mensagem dele', () => {
    expect(queryFlagOf('talvez')).toBe('talvez');
    expect(queryFlagOf(undefined)).toBeUndefined();
  });
});
