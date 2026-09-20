# maison-essence-api

Casca do backend da Maison Essence: NestJS em TypeScript estrito, preparado para
rodar como uma unica funcao serverless na Vercel.

Ha conexao com MongoDB via Mongoose, os schemas do dominio modelados e a
autenticacao do painel (login, refresh com rotacao, logout). As rotas de
negocio ainda nao existem.

## Rodando local

```bash
cp .env.example .env
# preencha MONGODB_URI (ver "Preparando o MongoDB Atlas")
npm install
npm run start:dev
```

`GET http://localhost:3333/api/v1/health` deve responder 200 com
`database.status` igual a `connected`. Sem banco acessivel a rota responde 503.

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
src/common/           filters, interceptors, decorators, enums, pipes, guards
src/config/           schema Zod e ConfigModule tipado
src/database/         conexao Mongoose, opcoes base e helpers de schema
src/health/           health check publico
src/modules/auth/     sessao do painel: login, tokens, guards
src/modules/          um diretorio por dominio, cada um com seus schemas
src/schemas.ts        ponto unico de importacao dos schemas
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
- `helmet`, `compression` e `cookie-parser` aplicados antes das rotas.
- Toda rota nasce autenticada. Rota aberta precisa de `@Public()` explicito
  (ver "Autenticacao").

## Variaveis de ambiente

Validadas com Zod no boot. Falta de variavel obrigatoria derruba o processo com
a lista do que falta e codigo de saida 1.

| Variavel       | Obrigatoria | Default       | Descricao                                |
| -------------- | ----------- | ------------- | ---------------------------------------- |
| `NODE_ENV`     | nao         | `development` | `development` \| `test` \| `production`  |
| `PORT`         | nao         | `3333`        | Porta local; ignorada na Vercel          |
| `CORS_ORIGINS` | **sim**     | —             | Origens separadas por virgula, ou `*`    |
| `APP_VERSION`  | nao         | package.json  | Versao exposta no `/health`              |
| `MONGODB_URI`  | **sim**     | —             | `mongodb://` ou `mongodb+srv://`         |
| `MONGODB_DB_NAME` | nao      | `maison-essence` | Nome do banco                         |
| `JWT_ACCESS_SECRET` | **sim** | —            | Assina o access token; minimo 32 caracteres |
| `JWT_REFRESH_SECRET` | **sim** | —           | Assina o refresh token; precisa ser diferente do de cima |

O nome do banco vem de `MONGODB_DB_NAME`, nao do caminho da URI: a string que o
Atlas entrega nao traz banco nenhum e o Mongoose cairia no default `test`.

## Banco de dados

`src/database/database.module.ts` registra a conexao com opcoes pensadas para
serverless:

| Opcao                      | Valor      | Por que                                    |
| -------------------------- | ---------- | ------------------------------------------ |
| `bufferCommands`           | `false`    | Query sem conexao falha na hora, em vez de esperar ate a funcao expirar |
| `maxPoolSize`              | `10`       | Cobre as queries paralelas de um request    |
| `minPoolSize`              | `0`        | Instancia ociosa nao segura socket no Atlas |
| `serverSelectionTimeoutMS` | `5000`     | Limite para achar um no do cluster          |
| `socketTimeoutMS`          | `45000`    | Limite por operacao                         |
| `autoIndex`                | so em dev  | Sincronizar indice a cada cold start custa uma ida ao banco por schema |

A conexao fica cacheada em `globalThis` (`src/database/connection-cache.ts`):
a primeira invocacao da instancia serverless abre o socket e as seguintes o
reaproveitam. O log `Conectado ao MongoDB` marca cada abertura real — se ele
aparecer uma vez por request, o cache quebrou.

## Schemas do dominio

Onze colecoes, cada uma no diretorio do seu dominio em
`src/modules/<dominio>/schemas/`. Todas sao reexportadas por `src/schemas.ts`,
que e o ponto unico de importacao:

```ts
import { Product, ProductSchema } from '../../schemas.js';

MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]);
```

| Colecao            | Papel                                             |
| ------------------ | ------------------------------------------------- |
| `users`            | Usuarios do painel: SUPER_ADMIN, OWNER, STAFF      |
| `refresh_tokens`   | Sessoes do painel, so o hash do token             |
| `login_attempts`   | Contador do rate limit do login, com TTL          |
| `categories`       | Um nivel de subcategoria, via `parentId`           |
| `products`         | Produto com variantes embutidas                    |
| `quantity_discounts` | Desconto progressivo, por produto ou categoria   |
| `delivery_cities`  | Cidades atendidas, com taxa fixa                   |
| `store_settings`   | Configuracoes da loja (documento unico)            |
| `payment_settings` | Regras de PIX e parcelamento (documento unico)     |
| `orders`           | Pedido, com snapshot imutavel de precos            |
| `customers`        | Conta de cliente, sempre opcional                  |

### Regras que valem para todos

**Dinheiro e inteiro em centavos.** Todo campo monetario termina em `Cents` e
passa por `centsProp()`, que recusa decimal: R$ 199,90 se escreve `19990`.
Ponto flutuante acumula erro no parcelamento, onde o total e dividido e somado
de volta e a soma precisa fechar no centavo. A validacao vale tambem no
`findOneAndUpdate` — `createSchema()` liga `runValidators`, que o Mongoose
deixa desligado por padrao e que e o caminho do `PATCH` do painel.

**Texto tem `trim` e tamanho maximo.** Sempre por `textProp({ max })`. O `trim`
nao e cosmetico: um espaco sobrando no fim do nome muda o slug gerado.

**Slug nasce do nome e nao muda depois.** `applySlugFrom()` preenche no
`pre('validate')` so quando o campo esta vazio, resolvendo homonimo com sufixo
(`importados`, `importados-2`). Renomear o produto depois nao mexe no endereco
dele, porque o link ja foi para o WhatsApp de alguem. Trocar de slug de
proposito e operacao do painel, que guarda o antigo em `previousSlugs`.

**O pedido e um documento congelado.** `Order.items` guarda nome, label da
variante, imagem, preco unitario, desconto e total da linha. `productId` e
`variantId` ficam sem `ref`, de proposito: nao existe `populate` possivel
neles, e e isso que impede alguem de exibir o preco de hoje num pedido de tres
meses atras. O mesmo vale para a cidade dentro de `fulfillment`.

**Enumeracoes sao objetos const**, nunca `enum` nativo, com o tipo derivado
exportado ao lado (`USER_ROLES` e `UserRole`). Ficam em `src/common/enums/`.

**Documentos unicos.** `StoreSettings` e `PaymentSettings` herdam de
`SingletonSchema` e expoem `getOrCreate()`, que devolve o documento existente
ou o cria com os padroes. O campo `singleton` carrega um indice unico: sem
ele, duas invocacoes serverless simultaneas num banco vazio criariam duas
configuracoes.

**Codigo do pedido.** `ME-AAMMDD-XXXX`, com sufixo aleatorio em base36
maiuscula e indice unico. A data e a do fuso da loja, nao a UTC da funcao:
um pedido das 21h nasceria com a data de amanha, e a dona le o codigo junto do
horario da mensagem.

### Indices

| Colecao | Indice | Para que |
| --- | --- | --- |
| `products` | `slug` unico | Rota publica por slug |
| `products` | texto em `name` e `brand` | Busca, com peso 10 no nome e 4 na marca |
| `products` | `isActive` + `categoryIds` + `createdAt` | Listagem publica filtrada |
| `categories` | `slug` unico, `previousSlugs`, `parentId` + `order` | Arvore do menu e redirecionamento |
| `orders` | `code` unico, `status` + `createdAt`, `customer.phone` + `createdAt` | Painel e historico do cliente |
| `users` | `email` unico, `role` + `isActive` | Login e contagem de administradores |
| `refresh_tokens` | `tokenHash` unico, `userId` + `revokedAt`, TTL em `expiresAt` | Rotacao e expiracao automatica |
| `login_attempts` | `key` unico, TTL em `expiresAt` | Rate limit do login |
| `delivery_cities` | `isActive` + `order`, `name` + `state` unico | Lista publica sem cidade duplicada |
| `customers` | `phone` unico, `email` unico parcial | Chave natural do cliente |
| `store_settings`, `payment_settings` | `singleton` unico | Garante o documento unico |

O indice de texto usa `default_language: 'portuguese'`, o que liga o stemming
da lingua: quem busca "velas" acha "vela".

### Declarando um schema novo

`baseSchemaOptions()` concentra `timestamps: true`, `versionKey: false` e o
transform de `toJSON` que troca `_id` por `id` e remove os campos internos. O
`@nestjs/mongoose` le o `@Schema()` da propria classe e nao sobe na cadeia de
heranca, entao cada schema declara as suas:

```ts
@Schema(baseSchemaOptions({ collection: 'produtos' }))
export class Product extends BaseSchema {
  @Prop(textProp({ required: true, max: 160 }))
  name: string;

  @Prop(centsProp({ required: true }))
  priceCents: number;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = createSchema(Product);
```

`createSchema()` no lugar de `SchemaFactory.createForClass()`: e ele que liga
a validacao nos updates por query. Subdocumentos usam
`embeddedSchemaOptions()`, com `_id: false` nos blocos singulares como os
totais do pedido.

## Autenticacao

Sessao do painel com dois tokens. O access token vale 15 minutos e acompanha
toda chamada; o refresh vale 7 dias, e trocado a cada uso e e o unico capaz de
emitir um access novo. A conta que isso fecha: o access token nao consulta
lista de revogacao a cada request (caro em serverless) porque a janela de
estrago dele e curta.

| Rota | Publica | O que faz |
| --- | --- | --- |
| `POST /auth/login` | sim | E-mail e senha; devolve o par de tokens |
| `POST /auth/refresh` | sim | Rotaciona o refresh e emite um access novo |
| `POST /auth/logout` | sim | Revoga a sessao apresentada; sempre 204 |
| `POST /auth/logout-all` | nao | Revoga todas as sessoes do usuario |
| `GET /auth/me` | nao | Usuario da sessao atual |

`/auth/refresh` e `/auth/logout` sao publicas porque quem autentica nelas e o
proprio refresh token: exigir access valido em uma rota cuja razao de existir e
o access ter expirado seria um ciclo.

### Onde os tokens viajam

Duas vias, de proposito:

- **Cookies `httpOnly`** — o caminho do painel. O JavaScript nunca toca no
  token, entao um XSS no painel nao consegue le-lo. Saem com `Secure` e
  `SameSite=None`, porque o painel roda em outro dominio da Vercel e sem isso o
  navegador descarta o cookie na chamada cross-site. Em `NODE_ENV=development`
  eles caem para `SameSite=Lax` sem `Secure`: o navegador recusa `None` sem
  HTTPS e o login local ficaria sem cookie nenhum.
- **Corpo da resposta** — `accessToken` e `refreshToken` tambem vem em JSON,
  para o cliente que nao aceita cookie de terceiro (app nativo, navegador com
  cookie cross-site bloqueado). Esse cliente manda o access em
  `Authorization: Bearer` e o refresh no corpo de `/auth/refresh`.

O `path` de cada cookie e restrito: o access vale em `/api/v1` e o refresh so
em `/api/v1/auth`. Assim o navegador nem envia a credencial de sessao nas
chamadas de catalogo ou de pedido.

### Rotacao e deteccao de reuso

Cada `/auth/refresh` revoga o token apresentado e emite outro, gravando
`replacedBy` no antigo — a arvore de substituicoes fica registrada. A troca
acontece em um `findOneAndUpdate` atomico, filtrando por `revokedAt: null`:
duas abas renovando ao mesmo tempo nao podem receber duas sessoes validas.

Apresentar um refresh token **ja revogado** derruba todas as sessoes do
usuario e responde 401. E a deteccao de reuso: se o token vazou, nao ha como
saber qual das duas partes e a legitima, entao as duas perdem a sessao e a
dona refaz o login. O incidente vai para o log com o id do usuario.

### O que invalida uma sessao

`User.credentialVersion` e copiado para dentro do access token e conferido
contra o banco em cada request. Incrementar o contador mata na hora todo
access token ja emitido, sem esperar os 15 minutos. Incrementam:
`/auth/logout-all`, a deteccao de reuso e (no modulo de usuarios) desativar
usuario e resetar senha.

O custo disso e uma leitura do usuario por request autenticado. E o que faz
"desativar usuario derruba a sessao dele" ser verdade, e nao uma promessa com
ate 15 minutos de atraso.

### Senha

`argon2id`, com 19 MiB de memoria, duas passagens e paralelismo 1 — a linha
recomendada pela OWASP, que cabe folgado na memoria da funcao serverless.
Nunca bcrypt, nunca SHA. O hash mora em `User.passwordHash`, que e
`select: false`: so o login o pede, com `.select('+passwordHash')`.

O refresh token, ao contrario, e guardado como SHA-256. Ele nao e uma senha:
e um JWT de entropia alta, imune a dicionario, e um KDF lento so acrescentaria
dezenas de milissegundos a cada renovacao. Vazamento da colecao nao vira
sessao nem em um caso nem no outro.

### Rate limit e resposta uniforme

Cinco tentativas falhas por 15 minutos, contadas por **IP + e-mail
combinados** (so por IP, um escritorio inteiro se bloqueia junto; so por
e-mail, qualquer um tranca a conta da dona de fora). O contador vive na
colecao `login_attempts`, e nao em memoria: cada invocacao serverless e um
processo novo, entao um contador em memoria nao limitaria nada. A chave e o
SHA-256 de `ip|email`, para a colecao nao virar uma lista de quem tentou
entrar. A resposta e um 429 seco, sem contador nem tempo restante.

Todo login recusado — e-mail inexistente, senha errada, usuario desativado —
devolve o mesmo 401 com a mesma mensagem e demora o mesmo tanto: o caminho
sem usuario tambem paga um argon2 (contra um hash descartavel) e a resposta
inteira tem piso de 350 ms. Sem isso, cronometrar as respostas entrega quais
e-mails tem conta no painel.

### Protecao por padrao

`JwtAuthGuard` e `PendingPasswordGuard` sao `APP_GUARD`: **toda rota nasce
protegida** e so abre com `@Public()`. Inverter esse padrao e onde mais se
esquece de uma rota.

Usuario com `mustChangePassword` faz login normalmente, e a flag viaja no
access token, mas toda rota administrativa responde 403 ate a troca. As
excecoes sao marcadas com `@AllowPendingPassword()` — hoje `/auth/me`,
`/auth/refresh`, `/auth/logout` e `/auth/logout-all`; a rota de troca de senha
entra no modulo de usuarios.

Em um controller, o usuario da sessao vem pelo parametro:

```ts
@Get('pedidos')
list(@CurrentUser() user: AuthenticatedUser) {
  return this.orders.listFor(user.id);
}
```

### Arquivos

```
src/modules/auth/
  auth.controller.ts        rotas e cookies
  auth.service.ts           login, refresh, logout
  token.service.ts          assina e confere os dois JWT
  refresh-token.service.ts  rotacao, deteccao de reuso, revogacao em massa
  password.service.ts       argon2id
  login-rate-limit.service.ts
  constant-time.ts          piso de tempo da resposta de login
  guards/                   JwtAuthGuard, PendingPasswordGuard
  strategies/jwt.strategy.ts
  schemas/                  refresh-token, login-attempt
```

## Preparando o MongoDB Atlas

1. **Cluster.** Em [cloud.mongodb.com](https://cloud.mongodb.com), crie um
   projeto e um cluster M0 (gratuito). Escolha a regiao mais proxima da regiao
   da funcao na Vercel — cada ida ao banco atravessa essa distancia.
2. **Usuario do banco.** Em *Database Access* > *Add New Database User*, use
   autenticacao por senha e o papel *Read and write to any database*. Guarde a
   senha: ela so aparece uma vez. Se a senha tiver caractere especial, use
   percent-encoding na URI (`@` vira `%40`, `:` vira `%3A`).
3. **Acesso de rede.** Em *Network Access* > *Add IP Address*, libere
   `0.0.0.0/0` (*Allow access from anywhere*). E obrigatorio: as funcoes
   serverless da Vercel nao tem IP fixo, entao nao ha faixa para liberar. Quem
   protege o banco nesse arranjo e a credencial, nao o firewall — use senha
   longa e aleatoria e um usuario por ambiente.
4. **String de conexao.** Em *Connect* > *Drivers*, copie a URI, troque
   `<db_password>` pela senha e coloque em `MONGODB_URI`.

Para restringir por IP e preciso sair do serverless: Vercel Secure Compute (no
plano Enterprise) da IP fixo, e o Atlas aceita peering de VPC.

## Deploy na Vercel

`vercel.json` reescreve todas as rotas para `/api/index`. A versao do Node vem
de `engines.node` no `package.json` (o campo `functions.runtime` do
`vercel.json` so aceita runtimes de terceiros no formato `pacote@versao`).

Defina `CORS_ORIGINS`, `MONGODB_URI`, `JWT_ACCESS_SECRET` e
`JWT_REFRESH_SECRET` (e `APP_VERSION` / `MONGODB_DB_NAME`, se quiser) nas
variaveis de ambiente do projeto na Vercel. Os cookies de sessao saem com
`SameSite=None; Secure` fora de desenvolvimento, o que exige HTTPS — na Vercel
isso ja e o padrao.

## Scripts

| Script             | O que faz                                  |
| ------------------ | ------------------------------------------ |
| `start:dev`        | Nest em watch mode na porta 3333           |
| `dev:vercel`       | `vercel dev` pelo handler serverless       |
| `build`            | Compila para `dist/`                       |
| `typecheck`        | `tsc --noEmit`                             |
| `test`             | Testes unitarios                           |
| `test:e2e`         | Testes de ponta a ponta                    |
| `test:schemas`     | Insere e le um documento de cada colecao   |
| `lint`             | oxlint                                     |
