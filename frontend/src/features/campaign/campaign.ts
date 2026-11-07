import type { PublicCampaign } from './campaign.types';

/**
 * A campanha escrita para a vitrine: funções puras, sem React e sem rede.
 *
 * O que mora aqui e o prazo por extenso, que e a única informação da faixa que
 * o servidor **não** manda pronta. Ele manda o instante (`endsAt`); quem sabe
 * que dia e hoje no relógio de quem esta lendo e o navegador — e a diferença
 * entre "até 09/11" e "último dia" e inteira dela.
 *
 * Nenhum valor em reais passa por este arquivo. Desconto, escassez e rótulo
 * vem escritos do servidor, em `coupon.view.ts`, pelo motivo de sempre: a tela
 * diz qual, o banco diz quanto.
 */

/** Prazo a partir do qual a faixa volta a escrever a data, em dias. */
const NEAR_DAYS = 6;

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/**
 * Quanto tempo a campanha ainda tem, em palavras.
 *
 * Cinco formas, e a escolha entre elas e o que separa urgência verdadeira de
 * contagem decorativa:
 *
 * - **sem prazo** devolve vazio. Campanha aberta não tem o que apressar, e um
 *   "até" inventado seria a loja fabricando escassez que a dona não pediu.
 * - **hoje** vira `Último dia`. E a frase que vende, e ela só pode aparecer
 *   quando e verdade.
 * - **amanhã** vira `Termina amanhã`.
 * - **até seis dias** vira `Termina domingo`. Dentro da semana, o nome do dia
 *   e mais rápido de entender que `15/11`: ninguém precisa abrir o calendário
 *   para saber se domingo e longe.
 * - **mais que isso** vira `Até 30/11`. Fora da semana o nome do dia volta a
 *   ser ambíguo — domingo pode ser este ou o outro — e a data e o honesto.
 *
 * O corte e por **dia de calendário**, e não por horas corridas: a campanha
 * que termina as 23h59 de hoje tem menos de um dia de vida e ainda assim e
 * último dia, que e como quem esta comprando pensa no prazo.
 */
export function campaignDeadlineLabel(endsAt: string | null, now: Date): string {
  const end = endsAt === null ? null : new Date(endsAt);

  if (end === null || Number.isNaN(end.getTime())) {
    return '';
  }

  const days = daysBetween(now, end);

  if (days <= 0) {
    return 'Último dia';
  }

  if (days === 1) {
    return 'Termina amanhã';
  }

  if (days <= NEAR_DAYS) {
    return `Termina ${WEEKDAY.format(end)}`;
  }

  return `Até ${DAY_MONTH.format(end)}`;
}

/**
 * Quantos dias de calendário separam dois instantes, no fuso de quem lê.
 *
 * Pela meia-noite local de cada um, e não pela diferença em milissegundos: as
 * 22h de hoje e as 2h de amanhã estão a quatro horas de distância e são dias
 * diferentes, e e o dia que a frase do prazo precisa contar.
 */
function daysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();

  return Math.round((end - start) / 86_400_000);
}

/**
 * A campanha tem vitrine própria.
 *
 * Cupom da loja inteira não tem, e não e falta: não ha recorte a mostrar, o
 * desconto vale no catálogo todo. Nesse caso a faixa manda para a vitrine
 * normal, em vez de abrir um endereço que repetiria o catálogo inteiro com
 * outro título em cima.
 */
export function hasShowcase(campaign: PublicCampaign): boolean {
  return !campaign.wholeStore;
}
