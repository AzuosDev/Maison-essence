import {
  WHATSAPP_NUMBER_PATTERN,
  normalizeWhatsappNumber,
  whatsappLinkOf,
} from './whatsapp-number.js';

describe('normalizeWhatsappNumber', () => {
  it('aceita o número já no formato internacional', () => {
    expect(normalizeWhatsappNumber('5588999999999')).toBe('5588999999999');
  });

  it('tira a pontuação que a dona cola do celular', () => {
    expect(normalizeWhatsappNumber('+55 (88) 99999-9999')).toBe('5588999999999');
    expect(normalizeWhatsappNumber(' 55.88.99999.9999 ')).toBe('5588999999999');
  });

  it('acrescenta o código do pais no número brasileiro que veio sem ele', () => {
    expect(normalizeWhatsappNumber('(88) 99999-9999')).toBe('5588999999999');
    // Fixo, oito digitos depois do DDD.
    expect(normalizeWhatsappNumber('8836110000')).toBe('558836110000');
  });

  it('não mexe em número de outro pais', () => {
    expect(normalizeWhatsappNumber('+351912345678')).toBe('351912345678');
  });

  it('trata vazio como "loja sem WhatsApp configurado"', () => {
    expect(normalizeWhatsappNumber('')).toBe('');
    expect(normalizeWhatsappNumber('   ')).toBe('');
  });

  it('recusa o que não e número de telefone', () => {
    expect(normalizeWhatsappNumber('fale comigo no zap')).toBeNull();
    expect(normalizeWhatsappNumber('88 99999-9999 ou 88 3611-0000')).toBeNull();
    expect(normalizeWhatsappNumber(5588999999999)).toBeNull();
    expect(normalizeWhatsappNumber(null)).toBeNull();
  });

  it('recusa número curto ou longo demais para ser internacional', () => {
    expect(normalizeWhatsappNumber('999999999')).toBeNull();
    expect(normalizeWhatsappNumber('5588999999999999')).toBeNull();
  });
});

describe('whatsappLinkOf', () => {
  it('monta o link da conversa', () => {
    expect(whatsappLinkOf('5588999999999')).toBe('https://wa.me/5588999999999');
  });

  it('não inventa link quando não há número', () => {
    expect(whatsappLinkOf('')).toBe('');
  });
});


/**
 * O padrao vale sobre o valor ja normalizado, e e ele que o DTO aplica. Ja
 * nasceu recusando tudo uma vez: escrito em template literal, o `\d` virou
 * um `d` e nenhum numero passava pelo painel.
 */
describe('WHATSAPP_NUMBER_PATTERN', () => {
  it('aceita o que a normalização devolve', () => {
    expect(WHATSAPP_NUMBER_PATTERN.test('5588999999999')).toBe(true);
    expect(WHATSAPP_NUMBER_PATTERN.test('351912345678')).toBe(true);
  });

  it('aceita vazio, que e a loja sem WhatsApp configurado', () => {
    expect(WHATSAPP_NUMBER_PATTERN.test('')).toBe(true);
  });

  it('recusa pontuação, letra e tamanho fora da faixa', () => {
    expect(WHATSAPP_NUMBER_PATTERN.test('+55 (88) 99999-9999')).toBe(false);
    expect(WHATSAPP_NUMBER_PATTERN.test('fale comigo no zap')).toBe(false);
    expect(WHATSAPP_NUMBER_PATTERN.test('5588999999')).toBe(false);
    expect(WHATSAPP_NUMBER_PATTERN.test('5588999999999999')).toBe(false);
  });
});
