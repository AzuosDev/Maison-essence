import { serializeParams, signParams } from './cloudinary.signature.js';

describe('serializeParams', () => {
  it('ordena pelo nome da chave, como o Cloudinary faz ao conferir', () => {
    expect(serializeParams({ timestamp: 1758326400, allowed_formats: 'jpg', public_id: 'x' })).toBe(
      'allowed_formats=jpg&public_id=x&timestamp=1758326400',
    );
  });

  it('deixa de fora valor vazio, que o navegador tambem nao envia', () => {
    expect(serializeParams({ folder: '', timestamp: 1 })).toBe('timestamp=1');
  });

  it('escreve numero como texto', () => {
    expect(serializeParams({ timestamp: 1758326400 })).toBe('timestamp=1758326400');
  });
});

describe('signParams', () => {
  /**
   * Valor fixo, e nao recalculado no teste: a assinatura so vale se for
   * exatamente a que o Cloudinary produz do outro lado. Mudar a ordenacao ou
   * o digest aqui quebra este teste, que e o ponto — o servidor responderia
   * "Invalid Signature" sem dizer o que mudou.
   */
  it('assina com SHA-1 sobre a string ordenada mais o segredo', () => {
    const signature = signParams(
      {
        allowed_formats: 'jpg,png,webp',
        public_id: 'maison-essence/products/asad-9f3a1c2b',
        timestamp: 1758326400,
        transformation: 'c_limit,w_2000,h_2000',
      },
      'test-cloudinary-secret',
    );

    expect(signature).toBe('b99b132e0b3f0e5ae34c3fcf493fac3d468f8e21');
  });

  it('muda quando qualquer parametro muda', () => {
    const base = { public_id: 'maison-essence/products/a', timestamp: 1 };

    expect(signParams(base, 'segredo')).not.toBe(
      signParams({ ...base, timestamp: 2 }, 'segredo'),
    );
  });
});
