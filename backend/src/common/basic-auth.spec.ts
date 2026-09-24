import { matchesBasicAuth } from './basic-auth.js';

const CREDENTIALS = { user: 'docs', password: 'senha-longa-da-documentacao' };

function header(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

describe('matchesBasicAuth', () => {
  it('aceita a credencial exata', () => {
    expect(matchesBasicAuth(header('docs', CREDENTIALS.password), CREDENTIALS)).toBe(true);
  });

  it('recusa a senha errada', () => {
    expect(matchesBasicAuth(header('docs', 'quase-a-senha-certa'), CREDENTIALS)).toBe(false);
  });

  it('recusa o usuário errado', () => {
    expect(matchesBasicAuth(header('outro', CREDENTIALS.password), CREDENTIALS)).toBe(false);
  });

  it('recusa cabeçalho ausente, vazio ou de outro esquema', () => {
    expect(matchesBasicAuth(undefined, CREDENTIALS)).toBe(false);
    expect(matchesBasicAuth('Basic', CREDENTIALS)).toBe(false);
    expect(matchesBasicAuth('Bearer abc.def.ghi', CREDENTIALS)).toBe(false);
  });

  it('aceita senha com dois pontos dentro', () => {
    // A comparacao e da linha inteira 'usuario:senha', como o esquema Basic
    // define: o separador e o primeiro dois-pontos, e o resto e a senha.
    const credentials = { user: 'docs', password: 'a:b:c-senha-longa' };

    expect(matchesBasicAuth(header('docs', 'a:b:c-senha-longa'), credentials)).toBe(true);
    expect(matchesBasicAuth(header('docs', 'a:b:c-senha-errada'), credentials)).toBe(false);
  });
});
