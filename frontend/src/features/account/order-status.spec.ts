import { expect, test } from 'vitest';
import { ORDER_STATUSES } from '@/features/checkout';
import { orderTimeline, statusLabel, statusTone } from './order-status';

/**
 * O pedido escrito para quem comprou.
 *
 * Dois assuntos, e os dois tem consequência fora do teste:
 *
 * 1. **As palavras são as mesmas do painel**, por decisão da dona, e quem
 *    marcou retirada e atendido pela descrição do passo — e ela que diz
 *    "já pode ser retirado na loja" sob o rótulo "Saiu para entrega".
 * 2. **A trilha não inventa data.** O pedido guarda duas — quando nasceu e
 *    quando mudou pela última vez —, e os passos do meio ficam sem horário
 *    de propósito. Uma data plausível escrita por um `Math` viraria um prazo
 *    cobrado da loja.
 */

const CRIADO = '2026-09-01T12:00:00.000Z';
const MUDOU = '2026-09-22T09:30:00.000Z';

function trilha(status: (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES], mode = 'delivery') {
  return orderTimeline({
    status,
    createdAt: CRIADO,
    updatedAt: MUDOU,
    mode: mode as 'delivery' | 'pickup',
  });
}

test('o cliente lê as mesmas palavras do painel', () => {
  // Uma palavra por estado, nas duas telas: foi o que a dona pediu. O que
  // muda com a retirada e a descrição do passo, e não o rótulo.
  expect(statusLabel(ORDER_STATUSES.PENDING_CONTACT)).toBe('Processando');
  expect(statusLabel(ORDER_STATUSES.SHIPPED)).toBe('Saiu para entrega');
  expect(statusLabel(ORDER_STATUSES.DELIVERED)).toBe('Entregue');
  expect(statusLabel(ORDER_STATUSES.CONFIRMED)).toBe('Vendido');
});

test('o status aposentado do ciclo antigo continua tendo palavra', () => {
  // Pode haver pedido parado nele. Um selo em branco seria pior.
  expect(statusLabel(ORDER_STATUSES.PREPARING)).toBe('Processando');
});

test('os tons dizem o mesmo que as palavras', () => {
  expect(statusTone(ORDER_STATUSES.PENDING_CONTACT)).toBe('gold');
  expect(statusTone(ORDER_STATUSES.DELIVERED)).toBe('success');
  expect(statusTone(ORDER_STATUSES.CONFIRMED)).toBe('success');
  expect(statusTone(ORDER_STATUSES.CANCELLED)).toBe('danger');
  expect(statusTone(ORDER_STATUSES.SHIPPED)).toBe('ink');
});

test('o pedido recém-feito esta no primeiro passo, com a data de criação', () => {
  const passos = trilha(ORDER_STATUSES.PENDING_CONTACT);

  expect(passos[0]?.state).toBe('current');
  expect(passos[0]?.at).toBe(CRIADO);
  expect(passos.slice(1).every((passo) => passo.state === 'pending')).toBe(true);
});

test('o passo atual leva a data da última mudanca', () => {
  const passos = trilha(ORDER_STATUSES.SHIPPED);
  const atual = passos.find((passo) => passo.state === 'current');

  expect(atual?.status).toBe(ORDER_STATUSES.SHIPPED);
  expect(atual?.at).toBe(MUDOU);
});

test('o pedido parado no status antigo aparece como processando', () => {
  // `PREPARING` saiu do ciclo. Sem este cuidado, a trilha de um pedido
  // gravado antes abriria sem passo atual nenhum.
  const passos = trilha(ORDER_STATUSES.PREPARING);

  expect(passos[0]?.state).toBe('current');
  expect(passos[0]?.status).toBe(ORDER_STATUSES.PENDING_CONTACT);
});

test('os passos cumpridos no meio aparecem sem data, e não com uma inventada', () => {
  // O critério honesto desta tela. Um pedido entregue passou por "saiu para
  // entrega"; dizer *quando* exigiria um número que não existe.
  const passos = trilha(ORDER_STATUSES.DELIVERED);
  const meio = passos.filter((passo) => passo.state === 'done').slice(1);

  expect(meio).toHaveLength(1);
  expect(meio.every((passo) => passo.at === null)).toBe(true);

  // O primeiro passo e a exceção: o pedido nasce nele, e essa data existe.
  expect(passos[0]?.at).toBe(CRIADO);
});

test('os passos que ainda não aconteceram ficam na trilha, apagados', () => {
  // Esconde-los faria a trilha de um pedido a caminho parecer terminada.
  const passos = trilha(ORDER_STATUSES.SHIPPED);

  expect(passos).toHaveLength(4);
  expect(passos.filter((passo) => passo.state === 'pending')).toHaveLength(2);
});

test('o cancelamento mostra só o que aconteceu, e não a fila com um X no fim', () => {
  const passos = trilha(ORDER_STATUSES.CANCELLED);

  expect(passos.map((passo) => passo.status)).toEqual([
    ORDER_STATUSES.PENDING_CONTACT,
    ORDER_STATUSES.CANCELLED,
  ]);

  expect(passos[1]?.at).toBe(MUDOU);
});

test('cada passo explica o que significa, e a explicação muda com o modo', () => {
  // O rótulo "Saiu para entrega" e igual para os dois; e aqui, na descrição,
  // que quem vai buscar na loja descobre que o pedido esta pronto.
  const entrega = trilha(ORDER_STATUSES.SHIPPED);
  const retirada = trilha(ORDER_STATUSES.SHIPPED, 'pickup');

  expect(entrega[1]?.description).toContain('endereço de entrega');
  expect(retirada[1]?.description).toContain('retirado na loja');
});
