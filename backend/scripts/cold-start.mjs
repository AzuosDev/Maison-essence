#!/usr/bin/env node
/**
 * Mede o cold start da funcao publicada.
 *
 * O teste em `test/serverless.e2e-spec.ts` mede o boot do Nest com o Mongo na
 * mesma maquina. Em producao falta a parte que so existe la: a Vercel subindo
 * um processo novo depois do periodo ocioso e o socket ate o Atlas, que fica
 * em outra regiao. Este script mede o que o cliente sente.
 *
 *   node scripts/cold-start.mjs https://sua-api.vercel.app
 *
 * A primeira chamada e a medida; as seguintes mostram o tempo com a instancia
 * ja quente, que e o numero com que o primeiro se compara. Sai com codigo 1
 * quando a primeira passa do teto ou quando o health check nao diz
 * `connected`, para poder virar passo de verificacao pos-deploy.
 *
 * Para medir um cold start de verdade, rode depois de alguns minutos sem
 * trafego: instancia quente responde em dezenas de milissegundos e nao prova
 * nada sobre o boot.
 */

const MAX_COLD_START_MS = 3_000;
const WARM_CALLS = 3;
const TIMEOUT_MS = 10_000;

const base = (process.argv[2] ?? process.env.API_URL ?? '').replace(/\/+$/, '');

if (!base) {
  console.error('Informe a URL base: node scripts/cold-start.mjs https://sua-api.vercel.app');
  process.exit(2);
}

const url = `${base}/api/v1/health`;

/** Uma chamada ao health check, com o tempo que ela levou. */
async function call() {
  const startedAt = performance.now();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'x-request-id': `cold-start-${Date.now()}` },
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const body = await response.json().catch(() => null);

  return { elapsedMs, status: response.status, body };
}

const first = await call();
const warm = [];

for (let attempt = 0; attempt < WARM_CALLS; attempt += 1) {
  warm.push((await call()).elapsedMs);
}

const database = first.body?.database?.status ?? 'desconhecido';

console.log(`URL              ${url}`);
console.log(`Primeira chamada ${first.elapsedMs} ms  (HTTP ${first.status})`);
console.log(`Ja quente        ${warm.join(' ms, ')} ms`);
console.log(`Banco            ${database}`);
console.log(`Versao           ${first.body?.version ?? '?'}`);

const problems = [];

if (first.status !== 200) {
  problems.push(`o health check respondeu HTTP ${first.status}`);
}

if (database !== 'connected') {
  problems.push(`a conexao com o banco esta "${database}", e nao "connected"`);
}

if (first.elapsedMs >= MAX_COLD_START_MS) {
  problems.push(`a primeira chamada levou ${first.elapsedMs} ms, acima do teto de ${MAX_COLD_START_MS} ms`);
}

if (problems.length > 0) {
  console.error(`\nFalhou: ${problems.join('; ')}.`);
  process.exit(1);
}

console.log(`\nOk: cold start dentro do teto de ${MAX_COLD_START_MS} ms e banco conectado.`);
