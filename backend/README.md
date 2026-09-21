# maison-essence-api

Casca do backend da Maison Essence: NestJS em TypeScript estrito, preparado para
rodar como uma unica funcao serverless na Vercel.

Ha conexao com MongoDB via Mongoose, os schemas do dominio modelados, a
autenticacao do painel (login, refresh com rotacao, logout), o controle de
acesso por papel com o CRUD de usuarios administrativos e os comandos que
criam o primeiro usuario e populam a loja de demonstracao. As rotas de
catalogo e de pedido ainda nao existem.

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

Com o banco de pe, dois comandos deixam o ambiente utilizavel: um cria o
usuario que abre o painel e o outro enche a loja de exemplo (ver "Primeiro
acesso" e "Dados de demonstracao").

```bash
npm run seed:superadmin
npm run seed:demo
```

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
src/modules/users/    CRUD de usuarios administrativos e policy de acesso
src/modules/          um diretorio por dominio, cada um com seus schemas
src/seeds/            comandos de primeiro acesso e de dados de exemplo
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
  (ver "Autenticacao") e rota restrita declara `@Roles(...)` (ver "Papeis e
  permissoes").

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
| `BOOTSTRAP_SUPERADMIN_EMAIL` | nao | — | Login do primeiro usuario (ver "Primeiro acesso") |
| `BOOTSTRAP_SUPERADMIN_PASSWORD` | nao | — | Senha temporaria dele; minimo 12 caracteres |
| `BOOTSTRAP_SUPERADMIN_NAME` | nao | `Super Admin` | Nome exibido no painel |
| `BOOTSTRAP_SECRET` | nao | — | Libera `POST /auth/bootstrap`; minimo 32 caracteres. **Remova depois do primeiro acesso** |

O nome do banco vem de `MONGODB_DB_NAME`, nao do caminho da URI: a string que o
Atlas entrega nao traz banco nenhum e o Mongoose cairia no default `test`.

As quatro `BOOTSTRAP_*` sao opcionais porque a API precisa subir sem elas: sao
justamente as que devem sair do ambiente depois do primeiro acesso. Variavel
vazia conta como ausente — apagar o valor no painel da Vercel deixa `''` para
tras, e `''` reprovado pelo schema derrubaria o deploy.

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
| `PATCH /auth/change-password` | nao | Troca a propria senha e devolve sessao nova |
| `GET /auth/me` | nao | Usuario da sessao atual |
| `POST /auth/bootstrap` | sim | Cria o primeiro SUPER_ADMIN de um banco vazio (ver "Primeiro acesso") |

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
`/auth/logout-all`, a deteccao de reuso, a troca de senha e, no modulo de
usuarios, desativar usuario, resetar senha e mudar o papel.

As tres primeiras encerram a sessao inteira (os refresh tokens tambem sao
revogados). Mudar o papel e o unico caso que so invalida o access token: a
sessao segue de pe e a proxima renovacao ja sai com o papel novo.

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

`JwtAuthGuard`, `PendingPasswordGuard` e `RolesGuard` sao `APP_GUARD`, nessa
ordem: **toda rota nasce protegida** e so abre com `@Public()`. Inverter esse
padrao e onde mais se esquece de uma rota.

Usuario com `mustChangePassword` faz login normalmente, e a flag viaja no
access token, mas toda rota administrativa responde 403 ate a troca. As
excecoes sao marcadas com `@AllowPendingPassword()`: `/auth/me`,
`/auth/refresh`, `/auth/logout`, `/auth/logout-all` e
`/auth/change-password`.

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

## Papeis e permissoes

Tres papeis, fechados em `src/common/enums/user-role.ts`:

| Papel | O que faz |
| --- | --- |
| `SUPER_ADMIN` | Tudo. Cria, edita, desativa e reseta senha de qualquer usuario. E o papel do desenvolvedor |
| `OWNER` | A loja inteira: catalogo, precos, pedidos, entrega, pagamento, configuracoes. Nos usuarios, alcanca so os `STAFF` |
| `STAFF` | Le o catalogo, le pedidos e atualiza status. Nao mexe em preco, configuracao nem usuario |

### Como uma rota declara o que exige

```ts
@Roles(...MANAGES_STORE)
@Patch(':id/price')
updatePrice() {}
```

- Rota **sem** `@Roles` exige apenas estar autenticado.
- Rota **`@Public()`** nao exige nada — e a unica forma de abrir uma rota.
- `SUPER_ADMIN` **nunca** aparece em lista de papeis: o `RolesGuard` sempre o
  libera. A lista onde alguem esquecesse de inclui-lo trancaria o
  desenvolvedor para fora do sistema, sem ninguem para reabrir.

Os conjuntos vivem em [`src/common/roles.ts`](src/common/roles.ts) —
`MANAGES_STORE`, `MANAGES_USERS`, `HANDLES_ORDERS`, `READS_CATALOG` — e nao
espalhados pelos controllers. Mudar quem mexe em preco e editar uma linha
daquele arquivo.

### O alcance do OWNER

Papel dito pelo `@Roles` e permissao grossa: ela responde "o OWNER pode mexer
em usuarios?". Quem responde "neste usuario?" e a policy em
[`user-access.policy.ts`](src/modules/users/user-access.policy.ts), que sao
funcoes puras testadas a parte:

- o OWNER gerencia apenas alvos `STAFF`;
- para o OWNER, um `SUPER_ADMIN` **nao existe**: some da listagem e responde
  **404**, nao 403. Confirmar que aquele id e um super-admin ja seria
  informacao;
- alvo visivel porem fora do alcance (OWNER sobre OWNER) responde **403**;
- corrigir o proprio nome e e-mail todo mundo pode, independente de alcance.
  Mudar o proprio papel, ninguem: o unico `SUPER_ADMIN` se rebaixaria por
  engano e nao sobraria quem o promovesse de volta.

## Usuarios administrativos

| Rota | Quem | O que faz |
| --- | --- | --- |
| `GET /users` | OWNER+ | Lista o que o ator enxerga |
| `POST /users` | OWNER+ | Cria com senha temporaria definida por quem cria |
| `PATCH /users/:id` | OWNER+ | Nome, e-mail e papel |
| `PATCH /users/:id/status` | OWNER+ | Ativa ou desativa |
| `POST /users/:id/reset-password` | OWNER+ | Gera senha temporaria nova |
| `PATCH /auth/change-password` | qualquer autenticado | Troca a propria senha |

("OWNER+" e OWNER e SUPER_ADMIN, dentro do alcance de cada um.)

### Criacao e senha temporaria

Quem cria digita a senha temporaria (minimo 12 caracteres) e o registro nasce
com `mustChangePassword: true` — quem criou conhece a senha, entao ela so pode
servir para o primeiro login. Enquanto a flag existir, toda rota
administrativa responde 403 e so `PATCH /auth/change-password` passa.

O reset e diferente: o servidor **gera** a senha, de 16 caracteres sem `0`,
`O`, `1`, `l` e `I` (ela vai ser lida em voz alta ou colada num WhatsApp), e a
devolve **uma unica vez** no corpo da resposta. Nao ha como consulta-la
depois, e por isso ela nunca entra no log.

### Invariantes

- **Ninguem desativa a si mesmo** (409).
- **O ultimo `SUPER_ADMIN` ativo nao pode ser desativado nem rebaixado** (409).
  A verificacao conta os outros ativos antes de gravar; com duas ou tres
  contas no painel a corrida teorica entre duas desativacoes simultaneas nao
  acontece, e resolve-la exigiria transacao, que o Atlas M0 nao garante.
- **Desativar revoga as sessoes na hora.** O access token do desativado para
  de valer na proxima chamada, nao quando expirar.
- **Resetar senha revoga as sessoes** do alvo.
- **Mudar o papel invalida o access token, mas nao a sessao**: `PATCH
  /users/:id` incrementa `credentialVersion` sem revogar os refresh tokens, e
  a proxima renovacao ja sai com o papel novo, sem novo login.
- **Trocar a propria senha** derruba as outras sessoes e devolve uma sessao
  nova para quem trocou — inclusive no caminho da senha temporaria, que
  terminaria em um login manual logo depois de uma troca obrigatoria.

### Auditoria

Toda acao sobre usuario sai como uma linha JSON no log, com ator, alvo, acao e
data ([`user-audit.log.ts`](src/common/user-audit.log.ts)):

```json
{"action":"user.deactivated","actor":{"id":"...","email":"root@...","role":"SUPER_ADMIN"},
 "target":{"id":"...","email":"staff@...","role":"STAFF"},"at":"2026-09-20T18:20:11.427Z"}
```

Acoes: `user.created`, `user.updated`, `user.activated`, `user.deactivated`,
`user.password_reset`, `user.password_changed`. Vai para o log do processo, que
na Vercel e o que fica pesquisavel, e nao para uma colecao: trilha de auditoria
dentro do banco que o proprio painel administra e apagavel por quem esta sendo
auditado. Senha e hash nunca aparecem ali.

## Primeiro acesso

O painel nao tem cadastro aberto, entao um banco novo comeca sem ninguem para
fazer login. Ha duas portas para criar o primeiro `SUPER_ADMIN`, e as duas
fazem a mesma coisa: mesmo servico, mesmo argon2id, mesma troca de senha
obrigatoria no fim.

As duas leem as mesmas variaveis:

| Variavel | Para que |
| --- | --- |
| `BOOTSTRAP_SUPERADMIN_EMAIL` | Login do primeiro usuario |
| `BOOTSTRAP_SUPERADMIN_PASSWORD` | Senha temporaria; minimo de 12 caracteres |
| `BOOTSTRAP_SUPERADMIN_NAME` | Nome exibido. Opcional, padrao `Super Admin` |

### Pelo terminal

```bash
npm run seed:superadmin
```

Idempotente: com um `SUPER_ADMIN` ja no banco ele avisa, nao cria nada e sai
com codigo 0. Rodar duas vezes nao e erro — e o que acontece com quem nao
lembra se ja rodou.

### Pela API, que e o caminho da Vercel

A Vercel nao da shell, entao o mesmo trabalho tem uma rota:

```bash
curl -X POST https://<seu-projeto>.vercel.app/api/v1/auth/bootstrap \
  -H "x-bootstrap-secret: $BOOTSTRAP_SECRET"
```

| Situacao | Resposta |
| --- | --- |
| Banco sem usuario nenhum e segredo certo | `201` com o usuario criado |
| `BOOTSTRAP_SECRET` fora do ambiente | `404` |
| Header ausente ou segredo errado | `401` |
| Ja existe **qualquer** usuario, nem que seja um STAFF | `409` |

A rota e mais rigorosa que o comando de proposito. O comando roda na maquina
de quem ja tem a URI do banco na mao e so precisa ser idempotente; a rota fica
exposta na internet, e "o banco tem gente" e um criterio que a fecha sozinha no
dia em que a loja cadastra o primeiro STAFF — mesmo que alguem esqueca o
segredo no ambiente.

> **Remova `BOOTSTRAP_SECRET` das variaveis de ambiente depois do primeiro
> acesso.** Sem ela a rota responde 404, como se nunca tivesse existido. Vale
> tirar junto `BOOTSTRAP_SUPERADMIN_EMAIL` e `BOOTSTRAP_SUPERADMIN_PASSWORD`:
> essa senha fica legivel no painel da Vercel e e a senha de quem pode tudo.

O usuario nasce com `mustChangePassword: true`. No primeiro login o painel so
libera `PATCH /auth/change-password`, e e ali que a senha que passou por
variavel de ambiente deixa de valer.

### Os seeds criam os indices

Antes de gravar qualquer coisa, os dois comandos conferem os indices de todas
as colecoes. `autoIndex` fica desligado fora de desenvolvimento (ver "Banco de
dados"), entao um cluster recem-criado no Atlas nao tem nem o unico de
`users.email` — e sem ele dois usuarios podem nascer com o mesmo login. Rodar
um dos seeds contra o banco novo resolve. E `createIndexes`: cria o que falta
e nunca derruba indice existente, que nao e decisao de um comando de seed.

## Dados de demonstracao

```bash
npm run seed:demo
```

Popula tres categorias, seis produtos com variantes, duas cidades de entrega e
as configuracoes de loja e de pagamento — o bastante para abrir o frontend e
ver uma loja de verdade sem cadastrar nada a mao. O conteudo esta em
[`src/seeds/demo-data.ts`](src/seeds/demo-data.ts).

Idempotente pela chave natural (slug do produto e da categoria, nome+estado da
cidade, documento unico das configuracoes): rodar de novo reescreve os mesmos
registros em vez de duplicar, e nao encosta no que foi cadastrado a mao fora
dessa lista.

Reescrever, porem, e destrutivo para quem ja mexeu no painel: as configuracoes
da loja voltam para os valores de demonstracao. Por isso o comando se recusa a
rodar com `NODE_ENV=production`. Quando for mesmo isso que voce quer:

```bash
npm run seed:demo -- --force
```

Nenhum registro traz imagem. O schema guarda `publicId` do Cloudinary, nao URL,
e um publicId inventado nao resolve em conta nenhuma: renderizaria imagem
quebrada no lugar do placeholder que o frontend ja sabe mostrar. Pela mesma
razao a home fica sem banner, que exige uma imagem para existir.

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

No primeiro deploy defina tambem as `BOOTSTRAP_*`, chame
`POST /api/v1/auth/bootstrap` uma vez e **remova `BOOTSTRAP_SECRET` em
seguida** (ver "Primeiro acesso"). Sem shell na Vercel, essa rota e a unica
forma de criar o usuario que abre o painel — e, com o segredo fora do
ambiente, ela volta a responder 404.

## Scripts

| Script             | O que faz                                  |
| ------------------ | ------------------------------------------ |
| `start:dev`        | Nest em watch mode na porta 3333           |
| `dev:vercel`       | `vercel dev` pelo handler serverless       |
| `build`            | Compila para `dist/`                       |
| `seed:superadmin`  | Cria o primeiro SUPER_ADMIN; idempotente   |
| `seed:demo`        | Popula catalogo, entrega e configuracoes   |
| `typecheck`        | `tsc --noEmit`                             |
| `test`             | Testes unitarios                           |
| `test:e2e`         | Testes de ponta a ponta                    |
| `test:schemas`     | Insere e le um documento de cada colecao   |
| `lint`             | oxlint                                     |
