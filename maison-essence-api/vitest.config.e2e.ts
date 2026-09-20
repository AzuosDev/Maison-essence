import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-mongo.ts'],
    // Subir o mongod in-memory e o Nest passa dos 5s padrao em maquina fria.
    hookTimeout: 60_000,
  },
});
