import { ROLE_LABELS } from './admin.roles';
import { ORDER_STATUS_LABELS } from './order-labels';
import { AUDIT_ACTIONS, type AuditEntry, type FieldChange } from './system.types';

/**
 * A trilha de auditoria, traduzida.
 *
 * O servidor grava o que aconteceu em duas formas diferentes, e as duas
 * chegam como `Mixed`:
 *
 * - **`changes`** — `{ campo: { from, to } }`. E o que as configurações, o
 *   preço e o status de pedido escrevem.
 * - **`details`** — um objeto livre. `user.created` põe `{ role: 'STAFF' }`;
 *   `user.updated` põe `{ name: 'Rayane' }` e, para o papel,
 *   `{ role: { de, para } }` — em português, porque quem escreveu aquela
 *   linha estava pensando na leitura.
 *
 * Este módulo transforma as duas em uma lista de `DiffLine`, que e o que a
 * tela desenha. E puro e não importa React de propósito: a parte difícil da
 * auditoria e entender o que mudou, e isso da para testar sem montar tela.
 *
 * ## O que ele não faz
 *
 * Não esconde nada. A redação de senha, token e hash acontece no servidor,
 * antes de gravar (`REDACTED_AUDIT_KEY`), e o que chega aqui já vem com
 * `[redigido]` no lugar do valor. Um segundo filtro aqui daria a impressão
 * de que a proteção e da tela — e a tela e o lugar errado para ela.
 */

/* ---- A ação ------------------------------------------------------------- */

/** O que cada ação conhecida diz, na voz de quem lê a trilha. */
const ACTION_LABELS: Record<string, string> = {
  [AUDIT_ACTIONS.LOGIN_SUCCEEDED]: 'Entrou no painel',
  [AUDIT_ACTIONS.LOGIN_FAILED]: 'Tentativa de entrada recusada',
  [AUDIT_ACTIONS.USER_CREATED]: 'Criou um usuário',
  [AUDIT_ACTIONS.USER_UPDATED]: 'Editou um usuário',
  [AUDIT_ACTIONS.USER_ACTIVATED]: 'Ativou um usuário',
  [AUDIT_ACTIONS.USER_DEACTIVATED]: 'Desativou um usuário',
  [AUDIT_ACTIONS.USER_PASSWORD_RESET]: 'Resetou uma senha',
  [AUDIT_ACTIONS.USER_PASSWORD_CHANGED]: 'Trocou a própria senha',
  [AUDIT_ACTIONS.SETTINGS_UPDATED]: 'Mudou as configurações da loja',
  [AUDIT_ACTIONS.PAYMENT_SETTINGS_UPDATED]: 'Mudou as condições de pagamento',
  [AUDIT_ACTIONS.PRODUCT_PRICE_CHANGED]: 'Mudou o preço de um produto',
  [AUDIT_ACTIONS.ORDER_STATUS_CHANGED]: 'Mudou o status de um pedido',
};

/**
 * A ação por extenso.
 *
 * Uma ação que este painel não conhece volta como o identificador cru — a
 * trilha guarda dois anos, e e melhor mostrar `estoque.ajustado` do que
 * esconder a linha por não ter tradução.
 */
export function describeAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** As ações que o filtro oferece, na ordem em que interessam. */
export const AUDIT_ACTION_OPTIONS: readonly { value: string; label: string }[] = Object.entries(
  ACTION_LABELS,
).map(([value, label]) => ({ value, label }));

/** Ação que merece destaque na lista: recusa de entrada e mexida em dinheiro. */
export function isSensitive(action: string): boolean {
  return (
    action === AUDIT_ACTIONS.LOGIN_FAILED ||
    action === AUDIT_ACTIONS.USER_PASSWORD_RESET ||
    action === AUDIT_ACTIONS.PRODUCT_PRICE_CHANGED ||
    action === AUDIT_ACTIONS.PAYMENT_SETTINGS_UPDATED
  );
}

/* ---- O diff ------------------------------------------------------------- */

/**
 * Uma linha do "o que mudou".
 *
 * `from` ausente e o caso do fato solto — `user.created` com o papel — onde
 * não havia valor anterior. A tela desenha uma seta só quando há os dois
 * lados.
 */
export interface DiffLine {
  /** O caminho do campo, como o servidor o gravou: `pickupAddress.city`. */
  path: string;
  /** O caminho por extenso: "Endereço de retirada · cidade". */
  label: string;
  from?: string;
  to: string;
}

/** Os campos cujo nome técnico ninguém reconhece. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  role: 'Papel',
  status: 'Status',
  storeName: 'Nome da loja',
  whatsappNumber: 'WhatsApp',
  announcement: 'Aviso do topo',
  pickupAddress: 'Endereço de retirada',
  priceCents: 'Preço',
  compareAtPriceCents: 'Preço de comparação',
  maxInstallments: 'Parcelas',
  pixDiscountPercent: 'Desconto no PIX',
  pixKey: 'Chave PIX',
  isActive: 'Publicado',
  stock: 'Estoque',
};

/**
 * O caminho por extenso.
 *
 * `pickupAddress.city` vira "Endereço de retirada · city": traduz o que
 * conhece, segmento a segmento, e deixa o resto como esta. Inventar uma
 * tradução para cada folha de cada objeto de configuração seria um dicionário
 * que envelhece sozinho; o segmento cru ainda responde a pergunta.
 */
export function describeField(path: string): string {
  return path
    .split('.')
    .map((segment) => FIELD_LABELS[segment] ?? segment)
    .join(' \u00b7 ');
}

/**
 * Um valor como ele aparece na tela.
 *
 * Os papéis e os status de pedido chegam como constante — `STAFF`,
 * `PENDING_CONTACT` — e são justamente os que mais aparecem na trilha. Os
 * dois dicionários que o resto do painel já usa traduzem, e a trilha fica
 * lendo igual ao que a dona vê nas outras telas.
 */
/**
 * As constantes que aparecem na trilha, já traduzidas.
 *
 * Papel e status de pedido chegam como `STAFF` e `PENDING_CONTACT`, e são os
 * dois valores que mais aparecem. Montado a partir dos mesmos dicionários que
 * o resto do painel usa: a trilha lê igual ao que a dona vê nas outras telas,
 * e um rótulo novo em pedidos chega aqui sem ninguém lembrar de copiar.
 */
const VALUE_LABELS: Record<string, string> = { ...ROLE_LABELS, ...ORDER_STATUS_LABELS };

export function describeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '\u2014';
  }

  if (typeof value === 'boolean') {
    return value ? 'sim' : 'nao';
  }

  if (typeof value === 'string') {
    return VALUE_LABELS[value] ?? value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return JSON.stringify(value);
}

/** `{ from, to }` do backend, ou `{ de, para }` do registro de usuário. */
function asChange(value: unknown): FieldChange | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if ('from' in record || 'to' in record) {
    return { from: record.from, to: record.to };
  }

  if ('de' in record || 'para' in record) {
    return { from: record.de, to: record.para };
  }

  return null;
}

/**
 * O que mudou, pronto para desenhar.
 *
 * Lê `changes` primeiro e `details` depois, porque e essa a ordem de
 * importância: `changes` e o diff de verdade, `details` e o contexto. Uma
 * entrada sem nenhum dos dois — o login, por exemplo — devolve lista vazia,
 * e a tela mostra só a ação. Não há o que explicar em "entrou no painel".
 */
export function diffOf(entry: Pick<AuditEntry, 'changes' | 'details'>): DiffLine[] {
  return [...linesFrom(entry.changes), ...linesFrom(entry.details)];
}

function linesFrom(source: Record<string, unknown> | null): DiffLine[] {
  if (source === null) {
    return [];
  }

  return Object.entries(source).map(([path, value]) => {
    const change = asChange(value);
    const label = describeField(path);

    if (change === null) {
      return { path, label, to: describeValue(value) };
    }

    return { path, label, from: describeValue(change.from), to: describeValue(change.to) };
  });
}
