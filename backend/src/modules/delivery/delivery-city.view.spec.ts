import { estimatedLabelOf } from './delivery-city.view.js';

describe('estimatedLabelOf', () => {
  it('concorda o singular com o plural', () => {
    expect(estimatedLabelOf(1)).toBe('Ate 1 dia util');
    expect(estimatedLabelOf(3)).toBe('Ate 3 dias uteis');
  });

  // Prazo zero e a entrega da cidade da loja, feita na moto no mesmo dia: o
  // rotulo "Ate 0 dias uteis" seria a maneira mais estranha possivel de
  // anunciar a melhor entrega que a loja faz.
  it('trata prazo zero como entrega no mesmo dia', () => {
    expect(estimatedLabelOf(0)).toBe('No mesmo dia');
  });
});
