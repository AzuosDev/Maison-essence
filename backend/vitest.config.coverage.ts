import { defineConfig } from 'vitest/config';

/**
 * As duas suites num run so, para medir cobertura.
 *
 * Separadas elas nao respondem a pergunta: os testes unitarios cobrem as
 * funcoes puras e quase nao tocam os services, e os e2e cobrem os services
 * sem saber das funcoes. Cobertura medida em qualquer um dos dois isolado
 * mede o alcance daquele arquivo de teste, e nao o do codigo.
 */
export default defineConfig({
  test: {
    projects: ['vitest.config.ts', 'vitest.config.e2e.ts'],
    coverage: {
      provider: 'v8',
      /**
       * A meta vale para os services de dominio, que e onde mora a regra:
       * preco, estoque, taxa, sessao. Controller e view ficam de fora de
       * proposito — o controller so encaminha, e exigir meta dele empurraria
       * o projeto a escrever teste de encaminhamento.
       */
      include: ['src/modules/**/*.service.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 70 },
    },
  },
});
