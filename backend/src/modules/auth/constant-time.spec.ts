import { withMinimumDuration } from './constant-time.js';

describe('withMinimumDuration', () => {
  it('segura o retorno até o piso de tempo', async () => {
    const startedAt = Date.now();
    const result = await withMinimumDuration(120, async () => 'pronto');

    expect(result).toBe('pronto');
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(115);
  });

  it('segura também a falha: o 401 não pode voltar antes do 200', async () => {
    const startedAt = Date.now();

    await expect(
      withMinimumDuration(120, () => Promise.reject(new Error('credenciais inválidas'))),
    ).rejects.toThrow('credenciais inválidas');

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(115);
  });

  it('não atrasa a operação que já passou do piso', async () => {
    const startedAt = Date.now();

    await withMinimumDuration(10, () => new Promise((resolve) => setTimeout(resolve, 60)));

    expect(Date.now() - startedAt).toBeLessThan(200);
  });
});
