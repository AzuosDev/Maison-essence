import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { FULFILLMENT_MODES, PAYMENT_METHODS } from './checkout.types';

/**
 * Os valores que a loja manda são os que o servidor aceita.
 *
 * ## Por que este arquivo existe
 *
 * A loja e a API são dois projetos, e os enums compartilhados são copiados a
 * mão de um lado para o outro — decisão registrada em `quote.types.ts`. O
 * preço dessa copia apareceu inteiro uma vez: o frontend escrevia `'PICKUP'`
 * e `'CARD'`, o backend esperava `'pickup'` e `'card'`, e o `@IsIn` do DTO
 * devolvia 400 em **toda** cotação. A sacola mostrava "não foi possível
 * calcular o total agora" e o checkout não fechava.
 *
 * Nada pegou isso antes do navegador: o TypeScript só conhece a copia deste
 * lado, e os testes de tela usavam a mesma copia errada nos mocks — dois
 * enganos que concordavam um com o outro.
 *
 * Então aqui a comparação e com o **arquivo do backend**, lido do disco como
 * texto. Não importa o módulo de lá (outro projeto, outro `tsconfig`, e um
 * `import` fora do `rootDir` quebraria o build da loja): lê, extrai as
 * strings e compara. Se qualquer um dos dois lados mudar sozinho, este teste
 * cai com os dois conjuntos a vista.
 *
 * Vale só para os enums que viajam em **minúsculas**. `ORDER_STATUSES` e
 * `USER_ROLES` são iguais dos dois lados desde sempre e por acaso — se um dia
 * um deles divergir, o lugar de descobrir isso e aqui também.
 */

/** Os valores de um objeto `as const` no fonte do backend. */
function valoresDoBackend(arquivo: string, constante: string): string[] {
  const caminho = fileURLToPath(
    new URL(`../../../../backend/src/common/enums/${arquivo}`, import.meta.url),
  );
  const fonte = readFileSync(caminho, 'utf8');

  const bloco = new RegExp(`export const ${constante} = \\{([^}]*)\\}`).exec(fonte);

  if (bloco === null) {
    throw new Error(`${constante} não foi encontrada em ${arquivo}`);
  }

  return [...(bloco[1] ?? '').matchAll(/'([^']+)'/g)].map((par) => par[1] ?? '');
}

test('os modos de entrega são os mesmos que o backend declara', () => {
  expect(Object.values(FULFILLMENT_MODES)).toEqual(
    valoresDoBackend('fulfillment-mode.ts', 'FULFILLMENT_MODES'),
  );
});

test('as formas de pagamento são as mesmas que o backend declara', () => {
  expect(Object.values(PAYMENT_METHODS)).toEqual(
    valoresDoBackend('payment-method.ts', 'PAYMENT_METHODS'),
  );
});

/**
 * A ordem também importa, e por isso os casos acima usam `toEqual` numa lista
 * e não um conjunto: `Object.values` segue a ordem de declaração, e os dois
 * arquivos declaram entrega antes de retirada e PIX antes de cartão. Um
 * `toEqual` que passasse com a ordem trocada esconderia uma troca de
 * significado entre as duas chaves.
 */
test('as chaves continuam apontando para o valor certo, e não só para algum', () => {
  expect(FULFILLMENT_MODES.PICKUP).toBe('pickup');
  expect(FULFILLMENT_MODES.DELIVERY).toBe('delivery');
  expect(PAYMENT_METHODS.PIX).toBe('pix');
  expect(PAYMENT_METHODS.CARD).toBe('card');
});
