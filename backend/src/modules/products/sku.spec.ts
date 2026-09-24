import { MAX_SKU_LENGTH, generateSku } from './sku.js';

describe('generateSku', () => {
  it('monta um código legível a partir do nome e do label', () => {
    expect(generateSku('Asad Lattafa', '100 ml', new Set())).toBe('ASAD-LATTAFA-100-ML');
  });

  it('tira acento, como o slug faz', () => {
    // Sem acento do lado direito de propósito: e o que o caso cobra.
    expect(generateSku('Perfume Árabe', '', new Set())).toBe('PERFUME-ARABE');
  });

  it('desvia com sufixo quando o código já esta ocupado no produto', () => {
    const taken = new Set(['VELA-DE-FIGO']);

    expect(generateSku('Vela de figo', '', taken)).toBe('VELA-DE-FIGO-2');
  });

  it('respeita o tamanho máximo do campo, com sufixo e tudo', () => {
    const nome = 'Perfume árabe importado edição limitada de colecionador';
    const taken = new Set([generateSku(nome, '100 ml', new Set())]);
    const sku = generateSku(nome, '100 ml', taken);

    expect(sku.length).toBeLessThanOrEqual(MAX_SKU_LENGTH);
    expect(sku).toMatch(/-2$/);
  });

  it('não devolve código vazio quando o nome só tem símbolos', () => {
    expect(generateSku('***', '', new Set())).not.toBe('');
  });
});
