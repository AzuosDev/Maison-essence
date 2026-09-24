import { expect, test } from 'vitest';
import { describeAction, describeField, describeValue, diffOf, isSensitive } from './audit-diff';

/**
 * A trilha traduzida.
 *
 * O que estes casos protegem e a leitura: a auditoria só serve se quem abre
 * entende o que aconteceu sem consultar o código do backend. As duas formas
 * de diff que o servidor grava — `{ from, to }` e `{ de, para }` — precisam
 * sair iguais do outro lado.
 */

test('a ação conhecida sai por extenso', () => {
  expect(describeAction('order.status_changed')).toBe('Mudou o status de um pedido');
});

test('a ação desconhecida sai como veio, e não some', () => {
  // A trilha guarda dois anos: uma ação criada depois desta versão do painel
  // tem de aparecer, ainda que sem tradução.
  expect(describeAction('estoque.ajustado')).toBe('estoque.ajustado');
});

test('recusa de entrada e mexida em dinheiro ganham destaque', () => {
  expect(isSensitive('login.failed')).toBe(true);
  expect(isSensitive('payment-settings.updated')).toBe(true);
  expect(isSensitive('login.succeeded')).toBe(false);
});

test('o caminho do campo e traduzido segmento a segmento', () => {
  expect(describeField('pickupAddress')).toBe('Endereço de retirada');
  expect(describeField('pickupAddress.city')).toBe('Endereço de retirada · city');
});

test('papel e status de pedido saem com o rótulo que o resto do painel usa', () => {
  expect(describeValue('STAFF')).toBe('Atendimento');
  expect(describeValue('PENDING_CONTACT')).toBe('Aguardando contato');
});

test('vazio, nulo e booleano viram texto legível', () => {
  expect(describeValue(null)).toBe('—');
  expect(describeValue('')).toBe('—');
  expect(describeValue(true)).toBe('sim');
  expect(describeValue(false)).toBe('nao');
});

test('o diff em inglês do backend vira antes e depois', () => {
  const lines = diffOf({
    changes: { status: { from: 'PENDING_CONTACT', to: 'CONFIRMED' } },
    details: null,
  });

  expect(lines).toEqual([
    { path: 'status', label: 'Status', from: 'Aguardando contato', to: 'Confirmado' },
  ]);
});

test('o diff em português do registro de usuário vira a mesma coisa', () => {
  // `users.service.ts` grava `{ role: { de, para } }` em `details`. As duas
  // formas existem no banco e as duas precisam ser lidas.
  const lines = diffOf({
    changes: null,
    details: { role: { de: 'STAFF', para: 'OWNER' } },
  });

  expect(lines).toEqual([
    { path: 'role', label: 'Papel', from: 'Atendimento', to: 'Gerente da loja' },
  ]);
});

test('o fato solto não inventa um valor anterior', () => {
  const lines = diffOf({ changes: null, details: { role: 'STAFF' } });

  expect(lines).toEqual([{ path: 'role', label: 'Papel', to: 'Atendimento' }]);
  expect(lines[0]?.from).toBeUndefined();
});

test('o que o servidor apagou continua apagado', () => {
  // A redação acontece antes de gravar. O que esta em teste e que a tela não
  // desfaz o trabalho dela ao formatar.
  const lines = diffOf({
    changes: { pixKey: { from: '[redigido]', to: '[redigido]' } },
    details: null,
  });

  expect(lines[0]?.to).toBe('[redigido]');
});

test('uma ação sem diff nenhum devolve lista vazia', () => {
  // O login e sobre quem agiu: não há o que explicar em "entrou no painel".
  expect(diffOf({ changes: null, details: null })).toEqual([]);
});
