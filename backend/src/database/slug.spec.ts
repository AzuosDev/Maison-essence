import { MAX_SLUG_LENGTH, slugify } from './slug.js';

describe('slugify', () => {
  it('tira acento e troca espaco por hifen', () => {
    expect(slugify('Perfume Árabe Intenso')).toBe('perfume-arabe-intenso');
  });

  it('preserva a letra sob a cedilha', () => {
    expect(slugify('Coleção Açaí')).toBe('colecao-acai');
  });

  it('colapsa pontuacao em um unico hifen', () => {
    expect(slugify('Asad — Elixir (100ml)!')).toBe('asad-elixir-100ml');
  });

  it('nao deixa hifen nas pontas', () => {
    expect(slugify('  ...Vela...  ')).toBe('vela');
  });

  it('respeita o tamanho maximo', () => {
    expect(slugify('a'.repeat(200))).toHaveLength(MAX_SLUG_LENGTH);
  });

  it('devolve vazio quando nao sobra nada aproveitavel', () => {
    expect(slugify('!!!')).toBe('');
  });
});
