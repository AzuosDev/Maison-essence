import { MAX_SKU_LENGTH, generateSku } from './sku.js';

describe('generateSku', () => {
  it('monta um codigo legivel a partir do nome e do label', () => {
    expect(generateSku('Asad Lattafa', '100 ml', new Set())).toBe('ASAD-LATTAFA-100-ML');
  });

  it('tira acento, como o slug faz', () => {
    expect(generateSku('Perfume Árabe', '', new Set())).toBe('PERFUME-ARABE');
  });

  it('desvia com sufixo quando o codigo ja esta ocupado no produto', () => {
    const taken = new Set(['VELA-DE-FIGO']);

    expect(generateSku('Vela de figo', '', taken)).toBe('VELA-DE-FIGO-2');
  });

  it('respeita o tamanho maximo do campo, com sufixo e tudo', () => {
    const nome = 'Perfume arabe importado edicao limitada de colecionador';
    const taken = new Set([generateSku(nome, '100 ml', new Set())]);
    const sku = generateSku(nome, '100 ml', taken);

    expect(sku.length).toBeLessThanOrEqual(MAX_SKU_LENGTH);
    expect(sku).toMatch(/-2$/);
  });

  it('nao devolve codigo vazio quando o nome so tem simbolos', () => {
    expect(generateSku('***', '', new Set())).not.toBe('');
  });
});
