import { describe, expect, it } from 'vitest';
import { campaignDeadlineLabel, hasShowcase } from './campaign';
import type { PublicCampaign } from './campaign.types';

/**
 * O prazo da campanha, por extenso.
 *
 * E a única informação da faixa que o servidor não manda pronta, e por isso a
 * única com regra deste lado. Todas as datas abaixo são locais de propósito:
 * o que decide se hoje e "último dia" e o relógio de quem esta lendo, e um
 * teste em UTC passaria em Londres e falharia no Cariri.
 */

/** Uma data local, para o teste não depender do fuso de quem roda. */
function local(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

describe('quanto tempo a campanha ainda tem', () => {
  const hoje = new Date(2026, 10, 7, 10);

  it('cala quando a campanha não tem prazo', () => {
    expect(campaignDeadlineLabel(null, hoje)).toBe('');
  });

  /*
   * O cadastro grava o fim do dia (23:59:59.999), e o servidor compara por
   * instante: a campanha que termina hoje ainda vale hoje. "Último dia" e a
   * frase que vende, e ela só pode aparecer quando e verdade.
   */
  it('hoje e último dia, mesmo faltando poucas horas', () => {
    expect(campaignDeadlineLabel(local(2026, 11, 7, 23), hoje)).toBe('Último dia');
  });

  it('amanhã tem nome próprio', () => {
    expect(campaignDeadlineLabel(local(2026, 11, 8), hoje)).toBe('Termina amanhã');
  });

  /*
   * Dentro da semana, o nome do dia e mais rápido de entender que a data:
   * ninguém precisa abrir o calendário para saber se domingo e longe.
   */
  it('dentro da semana, diz o dia da semana', () => {
    expect(campaignDeadlineLabel(local(2026, 11, 11), hoje)).toBe('Termina quarta-feira');
  });

  /*
   * Fora da semana o nome do dia volta a ser ambíguo — domingo pode ser este
   * ou o outro — e a data e o honesto.
   */
  it('mais longe que isso, volta a escrever a data', () => {
    expect(campaignDeadlineLabel(local(2026, 11, 30), hoje)).toBe('Até 30/11');
  });

  /*
   * O corte e por dia de calendário, e não por horas corridas. Entre as 10h de
   * hoje e as 2h de amanhã ha menos de um dia inteiro, e ainda assim são dois
   * dias — e e o dia que a frase precisa contar.
   */
  it('conta dias de calendário, não horas corridas', () => {
    expect(campaignDeadlineLabel(local(2026, 11, 8, 2), hoje)).toBe('Termina amanhã');
  });

  /* Prazo vencido não vira "faltam -2 dias": a campanha fora do ar nem chega a
     esta tela, e se chegar, último dia e o menos errado. */
  it('não inventa prazo negativo para uma data que já passou', () => {
    expect(campaignDeadlineLabel(local(2026, 11, 1), hoje)).toBe('Último dia');
  });

  it('cala diante de uma data que não e data', () => {
    expect(campaignDeadlineLabel('ontem', hoje)).toBe('');
  });
});

describe('a vitrine própria', () => {
  it('existe quando o cupom aponta produtos', () => {
    expect(hasShowcase(campaign({ wholeStore: false }))).toBe(true);
  });

  /*
   * Cupom da loja inteira não tem recorte a mostrar: a página repetiria o
   * catálogo com outro título em cima. A faixa manda para a vitrine normal.
   */
  it('não existe para o cupom da loja inteira', () => {
    expect(hasShowcase(campaign({ wholeStore: true }))).toBe(false);
  });
});

function campaign(over: Partial<PublicCampaign>): PublicCampaign {
  return {
    code: 'BLACKFRIDAY',
    title: 'Black Friday Maison',
    slug: 'black-friday-maison',
    tagline: 'Os cinco mais pedidos com desconto.',
    percentOff: 20,
    amountOffCents: null,
    discountLabel: '20% OFF',
    endsAt: null,
    wholeStore: false,
    scarcityLabel: '',
    ...over,
  };
}
