import { withMinimumDuration } from './constant-time.js';

describe('withMinimumDuration', () => {
  it('segura o retorno ate o piso de tempo', async () => {
    const startedAt = Date.now();
    const result = await withMinimumDuration(120, async () => 'pronto');

    expect(result).toBe('pronto');
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(115);
  });

  it('segura tambem a falha: o 401 nao pode voltar antes do 200', async () => {
    const startedAt = Date.now();

    await expect(
      withMinimumDuration(120, () => Promise.reject(new Error('credenciais invalidas'))),
    ).rejects.toThrow('credenciais invalidas');

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(115);
  });

  it('nao atrasa a operacao que ja passou do piso', async () => {
    const startedAt = Date.now();

    await withMinimumDuration(10, () => new Promise((resolve) => setTimeout(resolve, 60)));

    expect(Date.now() - startedAt).toBeLessThan(200);
  });
});
