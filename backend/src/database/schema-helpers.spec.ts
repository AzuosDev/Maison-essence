import mongoose from 'mongoose';
import { centsProp, enumProp, integerProp, percentProp, textProp } from './schema-helpers.js';

/**
 * Declarado para o generic do `Schema` ser explicito: a inferência a partir de
 * sete campos de `SchemaTypeOptions` estoura o limite de profundidade do
 * TypeScript (TS2589).
 */
interface SampleFields {
  priceCents: number;
  compareAtPriceCents: number;
  stock: number;
  discountPercent: number;
  interest: number;
  name: string;
  status: string;
}

const schema = new mongoose.Schema<SampleFields>({
  priceCents: centsProp({ required: true }),
  compareAtPriceCents: centsProp({ default: null }),
  stock: integerProp({ default: 0, max: 100 }),
  discountPercent: percentProp({ default: 0 }),
  interest: percentProp({ default: 0, max: 20, fractional: true }),
  name: textProp({ max: 10 }),
  status: enumProp(['novo', 'usado'] as const, { default: 'novo' }),
});

const Sample = mongoose.model('SchemaHelpersSample', schema);

type ValidationErrors = Record<string, mongoose.Error.ValidatorError | mongoose.Error.CastError>;

/** Valida sem tocar no banco e devolve os erros por campo. */
async function errorsOf(fields: Record<string, unknown>): Promise<ValidationErrors> {
  try {
    await new Sample(fields).validate();

    return {};
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return error.errors;
    }

    throw error;
  }
}

describe('centsProp', () => {
  it('rejeita preço em reais com centavos decimais', async () => {
    const errors = await errorsOf({ priceCents: 199.9 });

    expect(errors.priceCents).toBeDefined();
    expect(errors.priceCents.message).toContain('19990');
  });

  it('aceita o mesmo preço escrito em centavos', async () => {
    expect((await errorsOf({ priceCents: 19_990 })).priceCents).toBeUndefined();
  });

  it('rejeita valor negativo', async () => {
    expect((await errorsOf({ priceCents: -1 })).priceCents).toBeDefined();
  });

  it('rejeita valor acima do teto', async () => {
    expect((await errorsOf({ priceCents: 100_000_000 })).priceCents).toBeDefined();
  });

  it('aceita nulo no campo opcional', async () => {
    const errors = await errorsOf({ priceCents: 1, compareAtPriceCents: null });

    expect(errors.compareAtPriceCents).toBeUndefined();
  });

  it('rejeita texto que não e número', async () => {
    // O cast falha antes da validação: o erro e de tipo, não de regra.
    expect((await errorsOf({ priceCents: 'gratis' })).priceCents).toBeDefined();
  });
});

describe('integerProp', () => {
  it('rejeita fração', async () => {
    expect((await errorsOf({ priceCents: 1, stock: 1.5 })).stock).toBeDefined();
  });

  it('respeita o máximo', async () => {
    expect((await errorsOf({ priceCents: 1, stock: 101 })).stock).toBeDefined();
  });
});

describe('percentProp', () => {
  it('rejeita fração no percentual inteiro', async () => {
    const errors = await errorsOf({ priceCents: 1, discountPercent: 10.5 });

    expect(errors.discountPercent).toBeDefined();
  });

  it('aceita fração onde o negócio pede, como nos juros', async () => {
    expect((await errorsOf({ priceCents: 1, interest: 1.99 })).interest).toBeUndefined();
  });
});

describe('textProp', () => {
  it('remove espaço nas pontas', () => {
    const doc = new Sample({ priceCents: 1, name: '  vela  ' });

    expect(doc.get('name')).toBe('vela');
  });

  it('rejeita texto acima do tamanho máximo', async () => {
    expect((await errorsOf({ priceCents: 1, name: 'x'.repeat(11) })).name).toBeDefined();
  });
});

describe('enumProp', () => {
  it('rejeita valor fora da lista', async () => {
    expect((await errorsOf({ priceCents: 1, status: 'quebrado' })).status).toBeDefined();
  });
});
