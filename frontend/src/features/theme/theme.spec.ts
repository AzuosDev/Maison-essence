import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_THEME_MODE,
  THEME_COLORS,
  THEME_MODES,
  THEME_STORAGE_KEY,
  isThemeMode,
  readStoredMode,
  resolveTheme,
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
    removeItem: (chave: string) => {
      dados.delete(chave);
    },
  };
}

/** Um armazenamento bloqueado, como o de uma aba anonima sem dados de site. */
const bloqueado = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('a escolha guardada', () => {
  test('sem nada guardado, segue o sistema', () => {
    expect(readStoredMode(armazenamento())).toBe('system');
  });

  test('lê o que foi guardado', () => {
    expect(readStoredMode(armazenamento({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
  });

  test('valor estranho na chave não vira tema', () => {
    expect(readStoredMode(armazenamento({ [THEME_STORAGE_KEY]: 'roxo' }))).toBe('system');
  });

  test('escolher sistema apaga a chave em vez de gravar a palavra', () => {
    const storage = armazenamento({ [THEME_STORAGE_KEY]: 'dark' });

    writeStoredMode(storage, 'system');

    expect(storage.dados.has(THEME_STORAGE_KEY)).toBe(false);
  });

  /**
   * `localStorage` **lança** numa aba anonima com dados de site bloqueados —
   * não devolve `null`. Sem a guarda, a loja inteira deixaria de montar por
   * causa da preferência de tema.
   */
  test('armazenamento bloqueado não derruba a leitura nem a escrita', () => {
    expect(() => readStoredMode(bloqueado)).not.toThrow();
    expect(readStoredMode(bloqueado)).toBe(DEFAULT_THEME_MODE);
    expect(() => writeStoredMode(bloqueado, 'dark')).not.toThrow();
  });

  test('sem armazenamento nenhum também não derruba', () => {
    expect(readStoredMode(undefined)).toBe(DEFAULT_THEME_MODE);
    expect(() => writeStoredMode(undefined, 'dark')).not.toThrow();
  });
});

describe('o tema que fica na tela', () => {
  test('escolha explicita ignora o sistema', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  test('sistema acompanha o aparelho', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

test('isThemeMode recusa o que não e modo', () => {
  expect(isThemeMode('dark')).toBe(true);
  expect(isThemeMode('System')).toBe(false);
  expect(isThemeMode(null)).toBe(false);
  expect(isThemeMode(2)).toBe(false);
});

/* ---- As duas copias da lógica ------------------------------------------- */

const indexHtml = readFileSync(
  fileURLToPath(new URL('../../../index.html', import.meta.url)),
  'utf8',
);

/**
 * O script embutido no `index.html` repete esta lógica.
 *
 * Ele existe porque o tema precisa estar no documento antes da primeira
 * pintura, e importar um módulo ali reintroduziria a espera que ele evita.
 * O preço e uma copia — e o risco da copia e ela se separar do original sem
 * que nada quebre: o tema continuaria funcionando depois que o React monta,
 * só piscaria claro na abertura. Ninguém repara nisso numa revisão.
 *
 * Estes três casos amarram as duas pontas.
 */
describe('o script que roda antes da pintura', () => {
  test('usa a mesma chave de armazenamento', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  test('escreve o atributo só para os modos explicitos', () => {
    // `system` não pode aparecer como valor de `data-theme`: não há seletor
    // para essa palavra em `tokens.css`, e a página ficaria presa no claro.
    expect(indexHtml).toContain("mode === 'light' || mode === 'dark'");
    expect(indexHtml).not.toContain("'data-theme', 'system'");
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
