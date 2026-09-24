import { expect, test } from 'vitest';
import { ORDER_STATUSES } from '@/features/checkout';
import { orderTimeline, statusLabel, statusTone } from './order-status';

/**
 * O pedido escrito para quem comprou.
 *
 * Dois assuntos, e os dois tem consequencia fora do teste:
 *
 * 1. **Retirada e entrega leem o mesmo status de jeitos diferentes.** Quem
 *    marcou retirada nunca pode ver uma palavra sobre entrega.
 * 2. **A trilha nao inventa data.** O pedido guarda duas — quando nasceu e
 *    quando mudou pela ultima vez —, e os passos do meio ficam sem horario
 *    de proposito. Uma data plausivel escrita por um `Math` viraria um prazo
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

test('o mesmo status muda de palavra conforme entrega ou retirada', () => {
  expect(statusLabel(ORDER_STATUSES.SHIPPED, 'delivery')).toBe('A caminho');
  expect(statusLabel(ORDER_STATUSES.SHIPPED, 'pickup')).toBe('Pronto para retirada');
  expect(statusLabel(ORDER_STATUSES.DELIVERED, 'pickup')).toBe('Retirado');
});

test('o status que espera a loja nao diz ao cliente que ele tem de ligar', () => {
  // O painel chama de "Aguardando contato", que e uma tarefa da dona. Aqui a
  // mesma palavra faria a cliente achar que o proximo passo e dela.
  expect(statusLabel(ORDER_STATUSES.PENDING_CONTACT, 'delivery')).toBe('Aguardando confirmacao');
});

test('os tons dizem o mesmo que as palavras', () => {
  expect(statusTone(ORDER_STATUSES.PENDING_CONTACT)).toBe('gold');
  expect(statusTone(ORDER_STATUSES.DELIVERED)).toBe('success');
  expect(statusTone(ORDER_STATUSES.CANCELLED)).toBe('danger');
  expect(statusTone(ORDER_STATUSES.SHIPPED)).toBe('ink');
});

test('o pedido recem-feito esta no primeiro passo, com a data de criacao', () => {
  const passos = trilha(ORDER_STATUSES.PENDING_CONTACT);

  expect(passos[0]?.state).toBe('current');
  expect(passos[0]?.at).toBe(CRIADO);
  expect(passos.slice(1).every((passo) => passo.state === 'pending')).toBe(true);
});

test('o passo atual leva a data da ultima mudanca', () => {
  const passos = trilha(ORDER_STATUSES.PREPARING);
  const atual = passos.find((passo) => passo.state === 'current');

  expect(atual?.status).toBe(ORDER_STATUSES.PREPARING);
  expect(atual?.at).toBe(MUDOU);
});

test('os passos cumpridos no meio aparecem sem data, e nao com uma inventada', () => {
  // O criterio honesto desta tela. Um pedido entregue passou por confirmado
  // e por em preparo; dizer *quando* exigiria um numero que nao existe.
  const passos = trilha(ORDER_STATUSES.DELIVERED);
  const meio = passos.filter((passo) => passo.state === 'done').slice(1);

  expect(meio).toHaveLength(3);
  expect(meio.every((passo) => passo.at === null)).toBe(true);

  // O primeiro passo e a excecao: o pedido nasce nele, e essa data existe.
  expect(passos[0]?.at).toBe(CRIADO);
});

test('os passos que ainda nao aconteceram ficam na trilha, apagados', () => {
  // Esconde-los faria a trilha de um pedido confirmado parecer terminada.
  const passos = trilha(ORDER_STATUSES.CONFIRMED);

  expect(passos).toHaveLength(5);
  expect(passos.filter((passo) => passo.state === 'pending')).toHaveLength(3);
});

test('o cancelamento mostra so o que aconteceu, e nao a fila com um X no fim', () => {
  const passos = trilha(ORDER_STATUSES.CANCELLED);

  expect(passos.map((passo) => passo.status)).toEqual([
    ORDER_STATUSES.PENDING_CONTACT,
    ORDER_STATUSES.CANCELLED,
  ]);

  expect(passos[1]?.at).toBe(MUDOU);
});

test('cada passo explica o que significa, e a explicacao muda com o modo', () => {
  const entrega = trilha(ORDER_STATUSES.SHIPPED);
  const retirada = trilha(ORDER_STATUSES.SHIPPED, 'pickup');

  expect(entrega[3]?.description).toContain('endereco de entrega');
  expect(retirada[3]?.description).toContain('retirado na loja');
});
