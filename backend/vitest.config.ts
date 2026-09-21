import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Nome proprio para as duas suites poderem rodar juntas na medicao de
    // cobertura (ver vitest.config.coverage.ts), que exige projetos distintos.
    name: 'unit',
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
