import type { SettingsDiff } from '../../common/settings-audit.log.js';

/**
 * O diff que vai para a trilha de auditoria.
 *
 * Compara dois retratos das configuracoes e devolve so o que mudou, com o
 * caminho do campo como chave: `whatsappNumber`, `pickupAddress.city`,
 * `institutionalPages.quem-somos.isActive`.
 *
 * Bloco aninhado desce por caminho em vez de sair inteiro porque a pergunta
 * que a auditoria responde e "o que mudou?", e um `pickupAddress` completo
 * repetido de um lado e do outro obriga quem le a procurar a diferenca no
 * olho. Banners e paginas viram objetos indexados por id e por slug antes de
 * chegar aqui (ver `auditSnapshot`), e nao arrays: assim arrastar um banner
 * de lugar nao aparece como se todos tivessem sido reescritos.
 */

/** Retrato das configuracoes, com blocos aninhados e nenhum array. */
export type AuditSnapshot = Record<string, unknown>;

/**
 * Quanto de um texto cabe no log.
 *
 * O conteudo de uma pagina institucional vai a vinte mil caracteres, e
 * duplica-lo a cada virgula corrigida entope o log sem informar nada: a
 * trilha registra que a pagina mudou e quem mudou, nao guarda versoes do
 * texto.
 */
export const MAX_AUDIT_TEXT_LENGTH = 120;

export function diffOf(before: AuditSnapshot, after: AuditSnapshot): SettingsDiff {
  const changes: SettingsDiff = {};

  walk('', before, after, changes);

  return changes;
}

function walk(path: string, before: unknown, after: unknown, changes: SettingsDiff): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      walk(path === '' ? key : `${path}.${key}`, before[key], after[key], changes);
    }

    return;
  }

  if (isSameValue(before, after)) {
    return;
  }

  changes[path] = { from: summarize(before), to: summarize(after) };
}

/**
 * Objeto simples, e nao qualquer coisa com propriedades.
 *
 * `null` e array ficam de fora: array e comparado como valor unico (a ordem
 * faz parte do que mudou) e `null` e o valor "campo vazio", nao um bloco para
 * descer.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSameValue(before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) {
    return true;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after);
  }

  return false;
}

/**
 * Corta texto longo, dizendo quanto ficou de fora. Desce por dentro de
 * blocos e listas, que e como o texto chega quando um banner inteiro nasce
 * ou some.
 */
function summarize(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= MAX_AUDIT_TEXT_LENGTH) {
      return value;
    }

    const hidden = value.length - MAX_AUDIT_TEXT_LENGTH;

    return `${value.slice(0, MAX_AUDIT_TEXT_LENGTH)}… (+${hidden} caracteres)`;
  }

  if (Array.isArray(value)) {
    return value.map(summarize);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, summarize(inner)]),
    );
  }

  return value;
}
