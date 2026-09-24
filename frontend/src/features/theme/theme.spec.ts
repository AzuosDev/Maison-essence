import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_THEME_MODE,
  THEME_COLORS,
  THEME_MODES,
  THEME_STORAGE_KEY,
  initialMode,
  isThemeMode,
  readStoredMode,
  writeStoredMode,
} from './theme';

/** Um `localStorage` de mentira, com o mínimo que as funções pedem. */
function armazenamento(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));

  return {
    dados,
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
  };
}

/** Um armazenamento bloqueado, como o de uma aba anônima sem dados de site. */
const bloqueado = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

describe('a escolha guardada', () => {
  test('sem nada guardado, não há escolha', () => {
    expect(readStoredMode(armazenamento())).toBeUndefined();
  });

  test('lê o que foi guardado', () => {
    expect(readStoredMode(armazenamento({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
  });

  test('valor estranho na chave não vira tema', () => {
    expect(readStoredMode(armazenamento({ [THEME_STORAGE_KEY]: 'roxo' }))).toBeUndefined();
  });

  /**
   * As duas opções gravam.
   *
   * Enquanto existiu o modo `system`, escolher o padrão apagava a chave. Se
   * `light` voltasse a apagar, quem escolhesse claro num celular no modo
   * noturno acharia a loja escura de novo no carregamento seguinte.
   */
  test('escolher claro grava, e não apaga a chave', () => {
    const storage = armazenamento({ [THEME_STORAGE_KEY]: 'dark' });

    writeStoredMode(storage, 'light');

    expect(storage.dados.get(THEME_STORAGE_KEY)).toBe('light');
  });

  /**
   * `localStorage` **lança** numa aba anônima com dados de site bloqueados —
   * não devolve `null`. Sem a guarda, a loja inteira deixaria de montar por
   * causa da preferência de tema.
   */
  test('armazenamento bloqueado não derruba a leitura nem a escrita', () => {
    expect(() => readStoredMode(bloqueado)).not.toThrow();
    expect(readStoredMode(bloqueado)).toBeUndefined();
    expect(() => writeStoredMode(bloqueado, 'dark')).not.toThrow();
  });

  test('sem armazenamento nenhum também não derruba', () => {
    expect(readStoredMode(undefined)).toBeUndefined();
    expect(() => writeStoredMode(undefined, 'dark')).not.toThrow();
  });
});

describe('o tema com que a loja abre', () => {
  test('a escolha guardada manda, e ignora o aparelho', () => {
    const escolheuClaro = armazenamento({ [THEME_STORAGE_KEY]: 'light' });

    expect(initialMode(escolheuClaro, true)).toBe('light');

    const escolheuEscuro = armazenamento({ [THEME_STORAGE_KEY]: 'dark' });

    expect(initialMode(escolheuEscuro, false)).toBe('dark');
  });

  test('sem escolha, o aparelho decide o primeiro encontro', () => {
    expect(initialMode(armazenamento(), true)).toBe('dark');
    expect(initialMode(armazenamento(), false)).toBe('light');
  });

  test('sem escolha e sem aparelho que responda, fica o padrão', () => {
    expect(initialMode(bloqueado, false)).toBe(DEFAULT_THEME_MODE);
  });
});

test('isThemeMode recusa o que não é modo', () => {
  expect(isThemeMode('dark')).toBe(true);
  expect(isThemeMode('Light')).toBe(false);
  expect(isThemeMode('system')).toBe(false);
  expect(isThemeMode(null)).toBe(false);
  expect(isThemeMode(2)).toBe(false);
});

/* ---- As duas cópias da lógica ------------------------------------------- */

const indexHtml = readFileSync(
  fileURLToPath(new URL('../../../index.html', import.meta.url)),
  'utf8',
);

/**
 * O script embutido no `index.html` repete esta lógica.
 *
 * Ele existe porque o tema precisa estar no documento antes da primeira
 * pintura, e importar um módulo ali reintroduziria a espera que ele evita.
 * O preço é uma cópia — e o risco da cópia é ela se separar do original sem
 * que nada quebre: o tema continuaria funcionando depois que o React monta,
 * só piscaria claro na abertura. Ninguém repara nisso numa revisão.
 *
 * Estes casos amarram as duas pontas.
 */
describe('o script que roda antes da pintura', () => {
  test('usa a mesma chave de armazenamento', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  test('só pergunta ao aparelho quando não há escolha guardada', () => {
    expect(indexHtml).toContain("mode !== 'light' && mode !== 'dark'");
  });

  /** O modo que saiu não pode voltar por engano como valor do atributo. */
  test('não conhece mais o modo sistema', () => {
    expect(indexHtml).not.toContain("'system'");
  });

  test('usa as mesmas cores de barra do navegador', () => {
    expect(indexHtml).toContain(THEME_COLORS.dark);
    expect(indexHtml).toContain(THEME_COLORS.light);
  });
});

test('todo modo tem rótulo e descrição', async () => {
  const { THEME_LABELS, THEME_DESCRIPTIONS } = await import('./theme');

  for (const mode of THEME_MODES) {
    expect(THEME_LABELS[mode]).toBeTruthy();
    expect(THEME_DESCRIPTIONS[mode]).toBeTruthy();
  }
});
