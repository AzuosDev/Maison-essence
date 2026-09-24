import type { Request } from 'express';
import { hashOf, isNotModified, versionedEtag, weakEtag } from './etag.js';

function requestWith(ifNoneMatch?: string | string[]): Request {
  return { headers: ifNoneMatch === undefined ? {} : { 'if-none-match': ifNoneMatch } } as Request;
}

describe('hashOf', () => {
  it('muda quando o conteúdo muda', () => {
    expect(hashOf('{"whatsappNumber":"5588999999999"}')).not.toBe(
      hashOf('{"whatsappNumber":"5588988888888"}'),
    );
  });

  it('repete o mesmo valor para o mesmo conteúdo', () => {
    expect(hashOf('maison')).toBe(hashOf('maison'));
  });
});

describe('versionedEtag', () => {
  it('muda quando a loja e alterada, mesmo com o corpo igual', () => {
    const payload = { storeName: 'Maison Essence' };

    expect(versionedEtag(new Date('2026-09-20T12:00:00Z'), payload)).not.toBe(
      versionedEtag(new Date('2026-09-20T12:05:00Z'), payload),
    );
  });

  it('muda quando o corpo muda sozinho, com a mesma data de alteração', () => {
    const updatedAt = new Date('2026-09-20T12:00:00Z');

    // O caso do banner agendado: ninguém tocou nas configurações, mas a home
    // de hoje não e a de ontem.
    expect(versionedEtag(updatedAt, { banners: ['natal'] })).not.toBe(
      versionedEtag(updatedAt, { banners: [] }),
    );
  });
});

describe('isNotModified', () => {
  const etag = weakEtag('123-abc');

  it('reconhece a mesma versão', () => {
    expect(isNotModified(requestWith(etag), etag)).toBe(true);
  });

  it('ignora o prefixo fraco na comparação', () => {
    expect(isNotModified(requestWith('"123-abc"'), etag)).toBe(true);
  });

  it('aceita lista de etiquetas', () => {
    expect(isNotModified(requestWith(`W/"outra", ${etag}`), etag)).toBe(true);
  });

  it('aceita o curinga', () => {
    expect(isNotModified(requestWith('*'), etag)).toBe(true);
  });

  it('diz que mudou quando a etiqueta e outra', () => {
    expect(isNotModified(requestWith('W/"456-def"'), etag)).toBe(false);
  });

  it('diz que mudou quando o cliente não mandou etiqueta', () => {
    expect(isNotModified(requestWith(), etag)).toBe(false);
  });
});
