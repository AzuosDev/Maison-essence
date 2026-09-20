# maison-essence-api

Casca do backend da Maison Essence: NestJS em TypeScript estrito, preparado para
rodar como uma unica funcao serverless na Vercel.

Ainda nao ha banco de dados, autenticacao nem modulos de dominio.

## Rodando local

```bash
cp .env.example .env
npm install
npm run start:dev
```

`GET http://localhost:3333/api/v1/health` deve responder 200.

Para servir pela mesma rota que a Vercel usa em producao (passando pelo handler
serverless em `api/index.ts`):

```bash
npm run dev:vercel
```

O `vercel dev` exige login na Vercel no primeiro uso.

## Estrutura

```
api/index.ts          handler serverless: cria o Nest uma vez e reaproveita
src/main.ts           bootstrap local (localhost:3333)
src/bootstrap.ts      configuracao compartilhada pelos dois entrypoints
src/app.module.ts     modulo raiz, registra pipe/filtro/interceptor globais
src/common/           filters, interceptors, decorators, pipes, guards
src/config/           schema Zod e ConfigModule tipado
src/health/           health check publico
src/modules/          um diretorio por dominio (ainda vazio)
```

`src/bootstrap.ts` existe porque `main.ts` e `api/index.ts` precisam aplicar
exatamente a mesma configuracao (helmet, compression, CORS, prefixo global).

## Comportamento global

- Prefixo de rotas `/api/v1`.
- `ValidationPipe` com `whitelist`, `forbidNonWhitelisted` e `transform`.
- Erros sempre no formato `{ statusCode, message, error, timestamp, path }`.
  Stack trace nunca vai na resposta; vai so no log do servidor.
- Toda resposta passa por um interceptor que converte `ObjectId` em string e
  remove `__v` e `passwordHash` em qualquer profundidade.
- `helmet` e `compression` aplicados antes das rotas.

## Variaveis de ambiente

Validadas com Zod no boot. Falta de variavel obrigatoria derruba o processo com
a lista do que falta e codigo de saida 1.

| Variavel       | Obrigatoria | Default       | Descricao                                |
| -------------- | ----------- | ------------- | ---------------------------------------- |
| `NODE_ENV`     | nao         | `development` | `development` \| `test` \| `production`  |
| `PORT`         | nao         | `3333`        | Porta local; ignorada na Vercel          |
| `CORS_ORIGINS` | **sim**     | —             | Origens separadas por virgula, ou `*`    |
| `APP_VERSION`  | nao         | package.json  | Versao exposta no `/health`              |

## Deploy na Vercel

`vercel.json` reescreve todas as rotas para `/api/index`. A versao do Node vem
de `engines.node` no `package.json` (o campo `functions.runtime` do
`vercel.json` so aceita runtimes de terceiros no formato `pacote@versao`).

Defina `CORS_ORIGINS` (e `APP_VERSION`, se quiser) nas variaveis de ambiente do
projeto na Vercel.

## Scripts

| Script             | O que faz                                  |
| ------------------ | ------------------------------------------ |
| `start:dev`        | Nest em watch mode na porta 3333           |
| `dev:vercel`       | `vercel dev` pelo handler serverless       |
| `build`            | Compila para `dist/`                       |
| `typecheck`        | `tsc --noEmit`                             |
| `test`             | Testes unitarios                           |
| `test:e2e`         | Testes de ponta a ponta                    |
| `lint`             | oxlint                                     |
