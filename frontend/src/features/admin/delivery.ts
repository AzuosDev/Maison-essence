import { centsFromInput, centsToInput } from '@/lib/format';
import {
  DELIVERY_LIMITS,
  type AdminDeliveryCity,
  type CreateDeliveryCityInput,
  type UpdateDeliveryCityInput,
} from './admin.types';

/**
 * A tabela de taxas, enquanto esta sendo editada.
 *
 * ## Por que a linha guarda texto
 *
 * Mesma razao do cadastro de produto: no banco a taxa e um inteiro em
 * centavos, na tela e o que a dona esta digitando, e no meio do caminho ela
 * passa por `1`, `15`, `15,` — nenhum dos quais e um valor. O rascunho guarda
 * texto, e a conversao acontece uma vez, na saida, depois de validar.
 *
 * ## Tres campos, tres significados de "vazio"
 *
 * - **taxa vazia** e invalida. Zero e legitimo — "nao cobro para entregar
 *   aqui" —, mas em branco nao diz nada, e uma cidade sem taxa cadastrada
 *   nao pode entrar no checkout.
 * - **prazo vazio** vira zero, que significa "no mesmo dia". E o valor que a
 *   loja usa na cidade dela.
 * - **frete gratis vazio** e `null`, e `null` nao e "nao tem frete gratis":
 *   e "esta cidade nao tem regra propria", e ela passa a seguir o minimo
 *   global da loja. Confundir os dois faria a dona apagar sem querer a
 *   isencao de uma cidade achando que estava apagando nada.
 *
 * ## Por que existe um diff
 *
 * A linha e salva ao sair do campo, e quase sempre um campo so mudou. Mandar
 * a linha inteira a cada saida sobrescreveria com valores antigos o que outra
 * aba — ou a propria dona, em outra linha — acabou de mudar. `changesOf`
 * devolve so o que difere do que veio do servidor.
 */

/** Uma linha da tabela, com os numeros como texto. */
export interface CityDraft {
  name: string;
  state: string;
  /** `15,00`. */
  fee: string;
  /** Dias uteis, como inteiro digitado. */
  days: string;
  /** Vazio quando a cidade segue a regra global da loja. */
  freeFrom: string;
}

/** Onde os erros aparecem, por campo. */
export type CityErrors = Partial<Record<keyof CityDraft, string>>;

/** A cidade salva, aberta para edicao. */
export function draftFromCity(city: AdminDeliveryCity): CityDraft {
  return {
    name: city.name,
    state: city.state,
    fee: centsToInput(city.feeCents),
    days: String(city.estimatedDays),
    // `null` e "sem regra propria", e vira campo vazio — e nao `0,00`, que
    // seria "frete gratis em qualquer pedido".
    freeFrom: city.minOrderForFreeCents === null ? '' : centsToInput(city.minOrderForFreeCents),
  };
}

/** Uma cidade nova, com o prazo que a loja usa na maioria dos casos. */
export function emptyCityDraft(): CityDraft {
  return { name: '', state: '', fee: '', days: '1', freeFrom: '' };
}

/**
 * O que impede a linha de ser salva.
 *
 * Confere o que o servidor conferiria, e nada alem: uma tela que inventa
 * regra propria recusa o que a API aceitaria, e quem esta do outro lado nao
 * tem como saber qual das duas esta errada.
 */
export function validateCity(draft: CityDraft): CityErrors {
  const errors: CityErrors = {};

  if (draft.name.trim().length < 2) {
    errors.name = 'Escreva o nome da cidade.';
  } else if (draft.name.length > DELIVERY_LIMITS.name) {
    errors.name = `O nome passa de ${String(DELIVERY_LIMITS.name)} caracteres.`;
  }

  if (!/^[A-Za-z]{2}$/.test(draft.state.trim())) {
    errors.state = 'O estado e a sigla de duas letras, como CE.';
  }

  const fee = centsFromInput(draft.fee);

  if (fee === null) {
    errors.fee = 'Escreva a taxa, ou 0 se a entrega for gratuita.';
  } else if (fee < 0) {
    errors.fee = 'A taxa não pode ser negativa.';
  } else if (fee > DELIVERY_LIMITS.feeCents) {
    errors.fee = 'Essa taxa passa do limite do sistema.';
  }

  // Prazo em branco e aceito: vira zero, que e "no mesmo dia".
  if (draft.days.trim() !== '') {
    const days = Number.parseInt(draft.days, 10);

    if (!Number.isInteger(days) || days < 0) {
      errors.days = 'Escreva o prazo em dias, ou 0 para o mesmo dia.';
    } else if (days > DELIVERY_LIMITS.estimatedDays) {
      errors.days = `O prazo máximo e de ${String(DELIVERY_LIMITS.estimatedDays)} dias.`;
    }
  }

  if (draft.freeFrom.trim() !== '') {
    const free = centsFromInput(draft.freeFrom);

    if (free === null || free < 0) {
      errors.freeFrom = 'Escreva o valor a partir do qual o frete sai de graça.';
    } else if (free > DELIVERY_LIMITS.feeCents) {
      errors.freeFrom = 'Esse valor passa do limite do sistema.';
    }
  }

  return errors;
}

export function hasCityErrors(errors: CityErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** O corpo do `POST`. A validacao ja passou quando esta funcao e chamada. */
export function draftToCreate(draft: CityDraft): CreateDeliveryCityInput {
  return {
    name: draft.name.trim(),
    state: draft.state.trim().toUpperCase(),
    feeCents: centsFromInput(draft.fee) ?? 0,
    estimatedDays: daysOf(draft),
    minOrderForFreeCents: freeFromOf(draft),
  };
}

/**
 * Só o que mudou em relacao ao que veio do servidor.
 *
 * Devolve `null` quando nada mudou, e quem chama usa isso para nao gastar uma
 * chamada — sair de um campo sem alterar nada e o gesto mais comum de quem
 * esta conferindo a tabela.
 */
export function changesOf(
  draft: CityDraft,
  city: AdminDeliveryCity,
): UpdateDeliveryCityInput | null {
  const changes: UpdateDeliveryCityInput = {};

  const name = draft.name.trim();
  const state = draft.state.trim().toUpperCase();
  const fee = centsFromInput(draft.fee) ?? 0;
  const days = daysOf(draft);
  const freeFrom = freeFromOf(draft);

  if (name !== city.name) {
    changes.name = name;
  }

  if (state !== city.state) {
    changes.state = state;
  }

  if (fee !== city.feeCents) {
    changes.feeCents = fee;
  }

  if (days !== city.estimatedDays) {
    changes.estimatedDays = days;
  }

  if (freeFrom !== city.minOrderForFreeCents) {
    changes.minOrderForFreeCents = freeFrom;
  }

  return Object.keys(changes).length === 0 ? null : changes;
}

/**
 * O prazo em palavras, igual ao que a loja escreve.
 *
 * Copia fiel de `estimatedLabelOf` do backend, e a fidelidade e o ponto: o
 * prazo que a dona ve no painel precisa ser a mesma frase que a cliente le no
 * checkout. "Ate" porque o numero cadastrado e o pior caso — prometer "em 3
 * dias" e criar reclamacao no segundo dia.
 */
export function estimatedLabel(days: number): string {
  if (days <= 0) {
    return 'No mesmo dia';
  }

  return days === 1 ? 'Até 1 dia útil' : `Até ${String(days)} dias úteis`;
}

function daysOf(draft: CityDraft): number {
  const days = Number.parseInt(draft.days, 10);

  return Number.isInteger(days) && days >= 0 ? days : 0;
}

/** `null` devolve a cidade a regra global da loja. Ver a nota no topo. */
function freeFromOf(draft: CityDraft): number | null {
  return draft.freeFrom.trim() === '' ? null : centsFromInput(draft.freeFrom);
}
