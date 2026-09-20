import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('gera hash argon2id e nunca guarda a senha', async () => {
    const hash = await passwords.hash('senha-da-dona-2026');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('senha-da-dona-2026');
  });

  it('confere a senha correta e recusa a errada', async () => {
    const hash = await passwords.hash('senha-da-dona-2026');

    await expect(passwords.verify(hash, 'senha-da-dona-2026')).resolves.toBe(true);
    await expect(passwords.verify(hash, 'senha-da-dona-2025')).resolves.toBe(false);
  });

  it('sem hash devolve false em vez de estourar, gastando o mesmo tempo', async () => {
    const withHash = await passwords.hash('qualquer-uma');

    const startedAt = Date.now();
    await expect(passwords.verify(undefined, 'qualquer-uma')).resolves.toBe(false);
    const missing = Date.now() - startedAt;

    const comparedAt = Date.now();
    await passwords.verify(withHash, 'qualquer-uma');
    const present = Date.now() - comparedAt;

    // Os dois caminhos passam pelo argon2; a comparacao e frouxa de proposito,
    // porque o que importa e nao haver uma ordem de grandeza de diferenca.
    expect(missing).toBeGreaterThan(present / 10);
  });

  it('recusa hash em formato invalido sem lancar', async () => {
    await expect(passwords.verify('nao-e-um-hash', 'qualquer-uma')).resolves.toBe(false);
  });
});
