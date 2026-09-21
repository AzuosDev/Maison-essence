import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * A loja e um site estatico: nada aqui roda no servidor.
 *
 * O unico ponto de contato com o backend e `VITE_API_URL`, lido em
 * `src/lib/env.ts`. Nao ha proxy de desenvolvimento de proposito — com proxy,
 * a loja falaria com a API pela mesma origem so na sua maquina, e o CORS e os
 * cookies `sameSite` (que sao a parte fragil) so apareceriam em producao.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  css: {
    modules: {
      // `productCard` no TypeScript, `product-card` no CSS: cada lado escreve
      // do jeito que e idiomatico nele.
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]__[hash:base64:5]',
    },
  },

  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    // O router ja divide por rota; o que sobra em `vendor` e o que toda
    // pagina carrega de qualquer jeito.
    target: 'es2022',
    sourcemap: true,
  },
});
