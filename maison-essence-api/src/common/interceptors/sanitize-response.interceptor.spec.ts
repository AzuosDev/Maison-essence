import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { SanitizeResponseInterceptor } from './sanitize-response.interceptor.js';

class FakeObjectId {
  readonly _bsontype = 'ObjectId';

  constructor(private readonly hex: string) {}

  toHexString(): string {
    return this.hex;
  }
}

function run(payload: unknown): Promise<unknown> {
  const interceptor = new SanitizeResponseInterceptor();
  const next: CallHandler = { handle: () => of(payload) };

  return firstValueFrom(interceptor.intercept({} as ExecutionContext, next));
}

describe('SanitizeResponseInterceptor', () => {
  it('converte ObjectId para string', async () => {
    const result = await run({ _id: new FakeObjectId('507f1f77bcf86cd799439011') });

    expect(result).toEqual({ _id: '507f1f77bcf86cd799439011' });
  });

  it('remove __v e passwordHash em qualquer profundidade', async () => {
    const result = await run({
      name: 'Maison',
      __v: 3,
      passwordHash: 'segredo',
      owner: { email: 'a@b.com', passwordHash: 'segredo', __v: 1 },
    });

    expect(result).toEqual({ name: 'Maison', owner: { email: 'a@b.com' } });
  });

  it('percorre arrays e preserva Date', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const result = await run([{ _id: new FakeObjectId('abc'), createdAt, __v: 0 }]);

    expect(result).toEqual([{ _id: 'abc', createdAt }]);
  });

  it('usa toJSON quando disponivel', async () => {
    const doc = { toJSON: () => ({ _id: new FakeObjectId('xyz'), passwordHash: 'x' }) };
    const result = await run(doc);

    expect(result).toEqual({ _id: 'xyz' });
  });

  it('nao entra em loop com referencia circular', async () => {
    const node: Record<string, unknown> = { name: 'raiz' };
    node.self = node;

    await expect(run(node)).resolves.toEqual({ name: 'raiz' });
  });
});
