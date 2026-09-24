import mongoose from 'mongoose';
import { baseSchemaOptions } from './base.schema.js';

describe('baseSchemaOptions', () => {
  const schema = new mongoose.Schema(
    { name: String, passwordHash: String },
    baseSchemaOptions(),
  );
  const Sample = mongoose.model('BaseSchemaSample', schema);

  function toJSON(): Record<string, unknown> {
    const doc = new Sample({ name: 'vela de figo', passwordHash: 'segredo' });

    return doc.toJSON() as Record<string, unknown>;
  }

  it('troca _id por id em string', () => {
    const json = toJSON();

    expect(json).not.toHaveProperty('_id');
    expect(typeof json.id).toBe('string');
    expect(json.id).toMatch(/^[a-f0-9]{24}$/);
  });

  it('remove os campos internos', () => {
    const json = toJSON();

    expect(json).not.toHaveProperty('passwordHash');
    expect(json).not.toHaveProperty('__v');
  });

  it('desliga o versionKey e liga os timestamps', () => {
    expect(schema.get('versionKey')).toBe(false);
    expect(schema.get('timestamps')).toBe(true);
    expect(schema.path('createdAt')).toBeDefined();
    expect(schema.path('updatedAt')).toBeDefined();
  });

  it('aceita sobrescrever opções pontuais', () => {
    const custom = new mongoose.Schema({}, baseSchemaOptions({ collection: 'produtos' }));

    expect(custom.get('collection')).toBe('produtos');
    expect(custom.get('versionKey')).toBe(false);
  });
});
