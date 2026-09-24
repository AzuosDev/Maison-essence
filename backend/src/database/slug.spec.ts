import { MAX_SLUG_LENGTH, slugify } from './slug.js';

describe('slugify', () => {
  it('tira acento e troca espaço por hífen', () => {
    expect(slugify('Perfume Árabe Intenso')).toBe('perfume-arabe-intenso');
  });

  it('preserva a letra sob a cedilha', () => {
    expect(slugify('Coleção Açaí')).toBe('colecao-acai');
  });

  it('colapsa pontuação em um único hífen', () => {
    expect(slugify('Asad — Elixir (100ml)!')).toBe('asad-elixir-100ml');
  });

  it('não deixa hífen nas pontas', () => {
    expect(slugify('  ...Vela...  ')).toBe('vela');
  });

  it('respeita o tamanho máximo', () => {
    expect(slugify('a'.repeat(200))).toHaveLength(MAX_SLUG_LENGTH);
  });

  it('devolve vazio quando não sobra nada aproveitável', () => {
    expect(slugify('!!!')).toBe('');
  });
});
