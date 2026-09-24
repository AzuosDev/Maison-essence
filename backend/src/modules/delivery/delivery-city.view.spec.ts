import { estimatedLabelOf } from './delivery-city.view.js';

describe('estimatedLabelOf', () => {
  it('concorda o singular com o plural', () => {
    expect(estimatedLabelOf(1)).toBe('Até 1 dia útil');
    expect(estimatedLabelOf(3)).toBe('Até 3 dias úteis');
  });

  // Prazo zero e a entrega da cidade da loja, feita na moto no mesmo dia: o
  // rotulo "Ate 0 dias uteis" seria a maneira mais estranha possivel de
  // anunciar a melhor entrega que a loja faz.
  it('trata prazo zero como entrega no mesmo dia', () => {
    expect(estimatedLabelOf(0)).toBe('No mesmo dia');
  });
});
