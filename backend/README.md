# maison-essence-api

Backend da Maison Essence: NestJS em TypeScript estrito, rodando como uma unica
funcao serverless na Vercel, com MongoDB Atlas.

A loja nao processa pagamento: o cliente monta a sacola, o servidor recalcula
tudo — preco, desconto por quantidade, taxa de entrega, PIX, parcelas —, grava
o pedido com o estoque baixado e devolve a mensagem pronta para o WhatsApp da
dona. O que esta aqui: catalogo publico, carrinho e pedido, painel
administrativo (produtos, categorias, entrega, pagamentos, configuracoes,
usuarios), conta opcional de cliente, trilha de auditoria e o endurecimento de
producao (limite de chamadas, cabecalhos, log estruturado).

- Rotas: ver "Mapa de rotas" e a colecao em [`docs/`](docs/).
- Como rodar: abaixo. Como publicar: "Deploy na Vercel".

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
npm run seed:catalog  # opcional: o catalogo de verdade, em vez do de exemplo
```

Os dois sao idempotentes por chave natural, entao rodar de novo nao duplica
nada. O `seed:superadmin` le as variaveis `BOOTSTRAP_SUPERADMIN_*` do `.env` e
nao faz nada se ja existir um `SUPER_ADMIN`; o `seed:demo` cria categorias,
produtos com variantes e cidades de entrega (pelo slug e pelo par cidade +
estado) e **sobrescreve** as configuracoes da loja e de pagamento — por isso
ele se recusa a rodar com `NODE_ENV=production` sem `--force`. Serve tanto para
abrir o painel com conteudo quanto para ter ids reais para a colecao do
Postman.

Para conferir que esta tudo de pe antes de sair mexendo:

```bash
npm test          # unitarios, ~1s, sem banco
npm run test:e2e  # integracao, sobe um mongod em memoria
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
src/modules/rate-limit/ teto de chamadas de toda rota, contado no banco
src/modules/audit/      trilha das acoes sensiveis do painel
src/modules/          um diretorio por dominio, cada um com seus schemas
src/seeds/            comandos de primeiro acesso, de exemplo e de catalogo
src/database/seeds/data/ o catalog.json que o seed:catalog importa
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
- `helmet`, `compression` e `cookie-parser` aplicados antes das rotas (ver
  "Endurecimento").
- Toda rota nasce autenticada e com teto de chamadas. Rota aberta precisa de
  `@Public()` explicito (ver "Autenticacao") e rota restrita declara
  `@Roles(...)` (ver "Papeis e permissoes").
- Corpo limitado a 256 KB, e o que passa disso volta 413 — nao 500.
- Chave de objeto comecada por `$` ou com `.` no corpo e recusada com 400,
  antes de qualquer controller (ver "Endurecimento").
- Toda requisicao tem `x-request-id`, que volta no cabecalho da resposta e
  marca cada linha de log.

## Variaveis de ambiente

Validadas com Zod no boot. Falta de variavel obrigatoria derruba o processo com
a lista do que falta e codigo de saida 1.

| Variavel       | Obrigatoria | Default       | Descricao                                |
| -------------- | ----------- | ------------- | ---------------------------------------- |
| `NODE_ENV`     | nao         | `development` | `development` \| `test` \| `production`  |
| `PORT`         | nao         | `3333`        | Porta local; ignorada na Vercel          |
| `CORS_ORIGINS` | **sim**     | —             | Origens separadas por virgula; `*` e recusado no boot |
| `APP_VERSION`  | nao         | package.json  | Versao exposta no `/health`              |
| `MONGODB_URI`  | **sim**     | —             | `mongodb://` ou `mongodb+srv://`         |
| `MONGODB_DB_NAME` | nao      | `maison-essence` | Nome do banco                         |
| `JWT_ACCESS_SECRET` | **sim** | —            | Assina o access token; minimo 32 caracteres |
| `JWT_REFRESH_SECRET` | **sim** | —           | Assina o refresh token; precisa ser diferente do de cima |
| `JWT_CUSTOMER_ACCESS_SECRET` | **sim** | — | Assina o access token da conta de cliente; minimo 32 caracteres |
| `JWT_CUSTOMER_REFRESH_SECRET` | **sim** | — | Assina o refresh token do cliente; os quatro segredos precisam ser distintos |
| `CLOUDINARY_CLOUD_NAME` | nao | — | Conta das imagens; sem ela `/admin/uploads` responde 503 |
| `CLOUDINARY_API_KEY` | nao | — | Par publico da assinatura de upload |
| `CLOUDINARY_API_SECRET` | nao | — | Assina os uploads. **Nunca vai para o frontend** |
| `DOCS_USER` | nao | — | Usuario da autenticacao basica de `/api/v1/docs` |
| `DOCS_PASSWORD` | nao | — | Senha dela; minimo 12 caracteres. Sem as duas, a documentacao nao sobe em producao |
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
| `audit_entries`    | Trilha das acoes sensiveis do painel, com TTL      |
| `rate_limit_hits`  | Contador do limite de chamadas das rotas, com TTL  |

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
| `audit_entries` | `action` + `createdAt`, `targetId` + `createdAt`, TTL em `createdAt` | Leitura da trilha e retencao de dois anos |
| `rate_limit_hits` | `key` unico, TTL em `expiresAt` | Limite de chamadas de toda rota |

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

O login tem dois contadores, e os dois precisam passar. O primeiro e o teto da
rota, do limitador global (ver "Endurecimento"): cinco chamadas por 15 minutos
por IP, contando tambem as que acertam a senha — senao renovar sessao em laco
continuaria de graca. O segundo e o `LoginRateLimitService`, que conta so as
falhas, por **IP + e-mail combinados** (so por IP, um escritorio inteiro se
bloqueia junto; so por e-mail, qualquer um tranca a conta da dona de fora), na
colecao `login_attempts`.

Nenhum dos dois vive em memoria: cada invocacao serverless e um processo novo,
entao um contador em memoria nao limitaria nada. As duas chaves sao SHA-256 —
de `ip|email` e de `escopo|ip` —, para que nenhuma das colecoes vire uma lista
de quem tentou entrar. A resposta e um 429 seco, sem contador nem tempo
restante.

Todo login recusado — e-mail inexistente, senha errada, usuario desativado —
devolve o mesmo 401 com a mesma mensagem e demora o mesmo tanto: o caminho
sem usuario tambem paga um argon2 (contra um hash descartavel) e a resposta
inteira tem piso de 350 ms. Sem isso, cronometrar as respostas entrega quais
e-mails tem conta no painel.

### Protecao por padrao

`RateLimitGuard`, `JwtAuthGuard`, `PendingPasswordGuard` e `RolesGuard` sao
`APP_GUARD`, nessa ordem: **toda rota nasce protegida e com teto de chamadas**,
e so abre com `@Public()`. Inverter esse padrao e onde mais se esquece de uma
rota. O limite vem primeiro de proposito: a tentativa de login errada precisa
ser contada, e ela nunca passa do primeiro guard.

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

Acao sensivel do painel entra na colecao `audit_entries` **e** sai como linha
de log, as duas com o mesmo `requestId`
([`audit.service.ts`](src/modules/audit/audit.service.ts)):

```json
{"action":"product.price_changed","actorId":"...","actorEmail":"dona@...",
 "actorRole":"OWNER","targetKind":"product","targetId":"...","targetLabel":"Vela de lavanda",
 "changes":{"variants.0.priceCents":{"from":4990,"to":5490}},"requestId":"..."}
```

Sao os dois lugares de proposito: a colecao responde "quem mudou esse preco em
marco?" e sobrevive a retencao de log do provedor, que na Vercel guarda horas;
a linha de log e onde quem investiga um incidente agora ja esta olhando.

Acoes registradas: `login.succeeded`, `login.failed`, `user.created`,
`user.updated`, `user.activated`, `user.deactivated`, `user.password_reset`,
`user.password_changed`, `settings.updated`, `payment-settings.updated`,
`product.price_changed`, `order.status_changed`.

Senha, token e hash nunca aparecem ali: quem monta a entrada nao os coloca, e
o `AuditService` ainda apaga o valor de qualquer campo cujo nome cheire a
segredo, em qualquer profundidade. A chave PIX chega ja mascarada da origem —
os quatro ultimos caracteres ficam, porque e o que responde "para qual conta a
loja passou a receber?".

`record` nunca lanca: a acao auditada ja aconteceu quando a trilha e escrita, e
derrubar a resposta por causa do registro nao desfaz nada. Falha de escrita vai
para o log como erro.

A entrada fica dois anos, por indice TTL. Ela protege contra o uso indevido do
painel, que e o risco real de uma loja pequena, e nao contra quem tem acesso de
escrita ao banco — esse pode apagar a propria pegada, e trilha a prova disso
mora fora do sistema auditado.

## Endurecimento

Tudo desta secao e montado em [`src/bootstrap.ts`](src/bootstrap.ts), que vale
para os tres entrypoints — servidor local, funcao da Vercel e testes e2e.
Configuracao de seguranca que valesse so em um deles seria uma seguranca que
nao existe.

### Limite de chamadas

`RateLimitGuard` e global e **nenhuma rota fica sem teto**: a que nao declara
`@RateLimit()` herda o teto da sua categoria, e a categoria sai do `@Public()`
— rota aberta na internet de um lado, rota que exige credencial do outro.

| Escopo | Teto | Onde |
| --- | --- | --- |
| Login do painel e da loja | 5 por 15 min | `@RateLimit(LOGIN_RATE_LIMIT)` |
| Cadastro de cliente | 5 por hora | `@RateLimit(CUSTOMER_REGISTER_RATE_LIMIT)` |
| Criacao de pedido | 5 por 10 min, por IP **e** por telefone | `@RateLimit(ORDER_IP_RATE_LIMIT)` e `RateLimitService` |
| Cotacao do carrinho | 30 por min | `@RateLimit(QUOTE_RATE_LIMIT)` |
| Demais rotas publicas | 120 por min, somadas | padrao de `@Public()` |
| Rotas do painel | 300 por min, somadas | padrao das demais |

O orcamento das duas ultimas e por categoria, e nao por rota: quem navega pede
catalogo, categorias, cidades e configuracao na mesma tela, e um teto por rota
deixaria o robo multiplicar o limite pelo numero de rotas que conhece.

O contador vive na colecao `rate_limit_hits`, com janela fixa e TTL, porque em
serverless cada invocacao e um processo novo e a Vercel sobe varias em
paralelo — um `Map` em memoria zera no cold start e nao ve o que as outras
instancias contaram. Trocar por Redis, se o volume pedir, e reescrever so
[`mongo-throttler.storage.ts`](src/modules/rate-limit/mongo-throttler.storage.ts).

Quem chama e identificado pelo `x-forwarded-for`, e nao por `req.ip`: na Vercel
esse e sempre o endereco do proxy dela, ou seja, um unico balde para o mundo
inteiro. A chave gravada e o SHA-256 de `escopo|identidade`, para a colecao nao
virar um registro de quem visitou a loja.

O limite estourado responde 429 com mensagem generica — sem contador, sem
tempo restante e sem dizer qual regra estourou. So o `Retry-After` fica, para o
cliente legitimo que quer se comportar.

### Cabecalhos e origem

A API nao serve pagina: toda resposta e JSON. Entao a CSP e a mais fechada que
existe (`default-src 'none'`, nada de frame, nada de formulario), com HSTS de
180 dias e `nosniff`. A excecao e `/api/v1/docs`, que e uma pagina de verdade e
recebe a politica afrouxada montada **so naquele caminho**.

O CORS e uma lista, nunca um curinga: `CORS_ORIGINS` recusa `*` ja na validacao
do boot. Com `credentials: true` o curinga nem funcionaria no navegador, e a
liberacao "so para destravar o deploy" costuma virar permanente. Origem
desconhecida nao vira erro — ela apenas nao recebe os cabecalhos, e quem barra
a leitura e o navegador. Requisicao sem `Origin` passa: nao e navegador, e
nenhum `curl` carrega cookie de sessao de ninguem.

### Corpo da requisicao

Teto de **256 KB**. O maior corpo legitimo aqui e uma pagina institucional
inteira, e nenhuma imagem passa pela API — o upload e assinado e vai do
navegador direto para o Cloudinary. Acima do teto a resposta e 413 no formato
de erro da API: o parser do Express lanca um `Error` comum, fora do Nest, e sem
a traducao do filtro a defesa funcionando se anunciava como 500.

Toda chave de objeto comecada por `$` ou contendo `.` e recusada com 400 antes
de qualquer controller
([`mongo-operator-guard.ts`](src/common/mongo-operator-guard.ts)). `$ne` num
filtro devolve o primeiro usuario que existir e `role.0` alcanca dentro de um
documento que o codigo tratava como valor. Os DTOs ja descartariam isso; a
defesa na porta e para o que nao passa por DTO — a consulta montada a partir de
um objeto e o proximo endpoint que alguem escrever sem lembrar da regra.

### Log

Uma linha JSON por evento, com `level`, `time`, `context`, `requestId` e
`message` ([`json-logger.ts`](src/common/json-logger.ts)). Na Vercel cada linha
de stdout vira um evento, e evento estruturado se filtra por campo — texto
formatado so se procura por pedaco de frase.

O `requestId` vem de `AsyncLocalStorage`, entao qualquer `Logger` do projeto
sai com ele sem mudar assinatura nenhuma: da para ler a historia inteira de uma
requisicao juntando pelo mesmo valor. Ele aceita o `x-request-id` que vier de
fora — o frontend e a borda da Vercel ja geram o seu — e volta no cabecalho da
resposta, para quem viu o erro na tela saber dizer qual requisicao foi.

Senha, token, hash, chave PIX e telefone completo nunca entram numa linha. A
regra e aplicada em duas alturas: na origem, por quem escreve (`maskPhone`,
`maskPixKey`), e sobre a linha ja montada, como ultima rede
([`log-redaction.ts`](src/common/log-redaction.ts)) — porque a primeira depende
de alguem lembrar. Telefone sai como `88*****34`: o bastante para reconhecer o
pedido, insuficiente para ligar para alguem.

### Documentacao

Swagger em `/api/v1/docs`, gerado do proprio codigo. Em producao fica atras de
autenticacao basica (`DOCS_USER` e `DOCS_PASSWORD`), e **sem as duas variaveis
nao sobe**: a lista de rotas nao e segredo, mas uma documentacao aberta e um
mapa pronto de onde estao as rotas administrativas e o que cada uma aceita.

### Teto de tempo no banco

Toda query e toda agregacao saem com `maxTimeMS` de 5 segundos, aplicado no
`createSchema` para ninguem precisar lembrar
([`schema-helpers.ts`](src/database/schema-helpers.ts)). A funcao da Vercel tem
tempo maximo de execucao, e consulta pendurada nao volta com erro util: a
funcao e cortada e quem chamou recebe um 504 sem mensagem e sem log. Com o
teto, o proprio Mongo aborta e devolve um erro nomeado, que vira linha de log e
resposta. Cinco segundos e folgado para colecoes pequenas e indexadas —
consulta que passa disso esta errada, nao lenta.

## Mapa de rotas

Tudo sob `/api/v1`. A coluna **Quem** diz o que a rota exige: `publica` nao
exige nada, `sessao` exige estar autenticado no painel, `cliente` exige um
token de conta de cliente, e os papeis listados sao o que o `@Roles` pede —
lembrando que `SUPER_ADMIN` passa em todas (ver "Papeis e permissoes").

### Saude e documentacao

| Rota | Quem | O que faz |
| --- | --- | --- |
| `GET /health` | publica | Estado da API e da conexao com o banco. E o que o deploy valida |
| `GET /docs` | basic auth em producao | Swagger gerado do codigo (ver "Documentacao") |

### Autenticacao do painel

| Rota | Quem | O que faz |
| --- | --- | --- |
| `POST /auth/bootstrap` | segredo no header | Cria o primeiro `SUPER_ADMIN`. 404 sem `BOOTSTRAP_SECRET` |
| `POST /auth/login` | publica | Access + refresh, em corpo e em cookie. 5 por 15 min |
| `POST /auth/refresh` | publica | Rotaciona a sessao. Reuso derruba todas as sessoes |
| `POST /auth/logout` | publica | Revoga a sessao apresentada. Sempre 204 |
| `POST /auth/logout-all` | sessao | Derruba todas as sessoes do usuario |
| `PATCH /auth/change-password` | sessao | Troca a propria senha e devolve sessao nova |
| `GET /auth/me` | sessao | O usuario logado, com `mustChangePassword` |

### Loja (publicas)

| Rota | Quem | O que faz |
| --- | --- | --- |
| `GET /products` | publica | Vitrine paginada, com busca e filtros |
| `GET /products/featured` | publica | Prateleira de destaques |
| `GET /products/ready-to-ship` | publica | Prateleira de pronta entrega |
| `GET /products/best-sellers` | publica | Mais vendidos, a partir dos pedidos fechados |
| `GET /products/:slug` | publica | Pagina do produto; slug antigo aponta para o atual |
| `GET /categories` | publica | Arvore do menu |
| `GET /categories/:slug` | publica | Uma categoria |
| `GET /delivery-cities` | publica | Cidades atendidas, com taxa e regra de frete gratis |
| `GET /settings` | publica | Nome, WhatsApp, banners vigentes, horarios, redes |
| `GET /pages` | publica | Paginas institucionais publicadas |
| `GET /pages/:slug` | publica | Uma pagina institucional |
| `GET /payment-settings` | publica | PIX (sem a chave) e regras de parcelamento |
| `POST /cart/quote` | publica | Recalcula a sacola inteira no servidor. 30 por min |
| `POST /orders` | publica | Cria o pedido, baixa o estoque e devolve o link do WhatsApp. 5 por 10 min |

### Conta do cliente

| Rota | Quem | O que faz |
| --- | --- | --- |
| `POST /customer/register` | publica | Cadastro. 5 por hora por IP |
| `POST /customer/login` | publica | Entra pelo telefone. 5 por 15 min |
| `POST /customer/refresh` | publica | Rotaciona a sessao do cliente |
| `GET /customer/me` | cliente | Dados da conta |
| `PATCH /customer/me` | cliente | Nome, e-mail e ate dez enderecos |
| `GET /customer/orders` | cliente | Historico de pedidos |
| `GET /customer/orders/:code` | cliente | Um pedido, sem a anotacao interna |

### Painel

| Rota | Quem | O que faz |
| --- | --- | --- |
| `GET /admin/products` | OWNER, STAFF | Lista com busca, filtro e paginacao |
| `GET /admin/products/:id` | OWNER, STAFF | Produto com variantes |
| `POST /admin/products` | OWNER | Cria produto |
| `PATCH /admin/products/:id` | OWNER | Edita; mudanca de preco entra na auditoria |
| `PATCH /admin/products/:id/status` | OWNER | Ativa ou desativa |
| `DELETE /admin/products/:id` | OWNER | Exclui |
| `GET /admin/categories` | OWNER, STAFF | Arvore completa, ativas e inativas |
| `POST /admin/categories` | OWNER | Cria categoria |
| `PATCH /admin/categories/reorder` | OWNER | Ordem do menu |
| `PATCH /admin/categories/:id` | OWNER | Edita |
| `DELETE /admin/categories/:id` | OWNER | Exclui; 409 se ainda houver vinculo |
| `GET /admin/delivery-cities` | OWNER | Cidades, ativas e inativas |
| `POST /admin/delivery-cities` | OWNER | Cria cidade |
| `PATCH /admin/delivery-cities/reorder` | OWNER | Ordem da lista |
| `PATCH /admin/delivery-cities/:id` | OWNER | Edita taxa, prazo e regra propria |
| `DELETE /admin/delivery-cities/:id` | OWNER | Exclui |
| `GET /admin/orders` | OWNER, STAFF | Lista com status, periodo e busca |
| `GET /admin/orders/:id` | OWNER, STAFF | Pedido com a anotacao interna |
| `PATCH /admin/orders/:id/status` | OWNER, STAFF | Move o status; cancelar repoe o estoque |
| `PATCH /admin/orders/:id/notes` | OWNER, STAFF | Anotacao interna |
| `GET /admin/settings` | OWNER | Configuracoes da loja |
| `PATCH /admin/settings` | OWNER | Altera; entra na auditoria com o diff |
| `GET /admin/payment-settings` | OWNER | Regras de pagamento, com a chave PIX |
| `PATCH /admin/payment-settings` | OWNER | Altera PIX e parcelamento |
| `POST /admin/uploads/signature` | OWNER | Assina o envio direto ao Cloudinary |
| `POST /admin/uploads/confirm` | OWNER | Confirma o envio concluido |
| `DELETE /admin/uploads/:publicId` | OWNER | Remove a imagem |
| `GET /users` | OWNER | Lista usuarios ao alcance de quem pergunta |
| `POST /users` | OWNER | Cria usuario com senha temporaria |
| `PATCH /users/:id` | OWNER | Nome, e-mail e papel |
| `PATCH /users/:id/status` | OWNER | Ativa ou desativa; desativar derruba as sessoes |
| `POST /users/:id/reset-password` | OWNER | Nova senha temporaria |
| `GET /admin/system/collections` | SUPER_ADMIN | Documentos por colecao registrada |

### Colecao para o Postman e o Insomnia

[`docs/maison-essence.postman_collection.json`](docs/maison-essence.postman_collection.json)
traz as 62 rotas acima com exemplos preenchidos. O formato e o do Postman
(schema v2.1), que o Insomnia importa direto em **Import > File**.

O login do painel e o do cliente guardam os tokens nas variaveis da colecao,
entao a ordem de uso e: ajustar `baseUrl`, rodar **Login**, e sair chamando o
resto. Ids de exemplo (`productId`, `cityId`, ...) sao variaveis — preencha com
o que houver no seu banco, ou rode `npm run seed:demo` e copie de la.

## Testes

```bash
npm test          # unitarios: regras puras, sem banco (~1s)
npm run test:e2e  # integracao: sobe um mongod em memoria e o Nest inteiro
npm run test:cov  # as duas suites juntas, com a meta de cobertura
```

Os unitarios (`src/**/*.spec.ts`) vivem ao lado do que testam e cobrem o que e
conta: parcelamento, taxa de entrega, desconto por quantidade, mensagem do
WhatsApp, slug, SKU, mascara de telefone, politica de acesso. Onde a regra ja e
funcao pura, o teste chama a funcao; onde ela depende de configuracao da loja
— `InstallmentService`, `DeliveryService.resolveFee` — o teste monta um dublê
das configuracoes e exercita o service.

Os de integracao (`test/**/*.e2e-spec.ts`) sobem a aplicacao de verdade contra
um MongoDB em memoria (`mongodb-memory-server`), pelo mesmo `configureApp` que
roda em producao. Os tres caminhos que nao se provam de outro jeito:

- **login e refresh com deteccao de reuso**: apresentar duas vezes o mesmo
  refresh token derruba a arvore inteira de sessoes daquele usuario
  ([`auth.e2e-spec.ts`](test/auth.e2e-spec.ts));
- **pedido com baixa atomica de estoque**: o pedido criado baixa exatamente o
  que vendeu, e o cancelamento repoe uma vez so
  ([`orders.e2e-spec.ts`](test/orders.e2e-spec.ts));
- **corrida pela ultima unidade**: dois pedidos simultaneos pela mesma peca —
  um recebe 201, o outro 409, e o estoque termina em zero.

A meta de cobertura e **70%** e vale para os services de dominio
(`src/modules/**/*.service.ts`), configurada em
[`vitest.config.coverage.ts`](vitest.config.coverage.ts). Controller e view
ficam de fora de proposito: o controller so encaminha, e exigir meta dele
empurraria o projeto a escrever teste de encaminhamento. Hoje os services estao
em ~90% de linhas; o unico bem abaixo e o `CloudinaryService`, que e chamada de
rede a um servico de terceiro e e testado por dublê nas rotas de upload.

## Integracao continua

[`.github/workflows/backend.yml`](../.github/workflows/backend.yml) roda lint,
tipos, build e as duas suites com cobertura, tudo com `working-directory:
backend`. O gatilho e por caminho — `backend/**` e o proprio workflow —, entao
mexer no frontend nao dispara os testes da API. A versao do Node vem de
`engines.node`, a mesma que a funcao da Vercel usa: CI que testa em outra
versao testa outro ambiente.

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

## Importacao do catalogo

```bash
npm run seed:catalog
```

Le [`src/database/seeds/data/catalog.json`](src/database/seeds/data/catalog.json)
e importa categorias e produtos. E o comando da carga inicial e o da
atualizacao de preco quando o fornecedor manda lista nova — nao o de dados de
exemplo, que e o `seed:demo`.

O arquivo e um objeto com duas chaves:

```json
{
  "categories": [
    { "slug": "perfumes", "name": "Perfumes", "parentSlug": null, "order": 1, "isActive": true }
  ],
  "products": [
    {
      "name": "Khamrah Qahwa",
      "slug": "khamrah-qahwa",
      "brand": null,
      "description": "",
      "categorySlugs": ["arabes-masculinos"],
      "images": [],
      "tags": [],
      "isActive": true,
      "isFeatured": false,
      "isReadyToShip": false,
      "sourceCatalog": "AM Atacadista - Originais",
      "variants": [
        {
          "sku": "ME-0036",
          "label": "",
          "priceCents": 15500,
          "compareAtPriceCents": null,
          "stock": 0,
          "allowBackorder": false,
          "image": null,
          "isActive": true
        }
      ]
    }
  ]
}
```

As categorias entram primeiro, as raizes (`parentSlug: null`) antes das filhas,
e so entao os produtos — que resolvem `categorySlugs` para os `_id` reais. Os
campos de metadados que o arquivo carrega (`$schema`, `generatedAt`,
`currency`, `priceUnit`, `notes`) sao lidos por quem abre o arquivo e ignorados
pela importacao. `sourceCatalog` tambem: o produto nao tem campo para guardar
de qual lista de fornecedor a linha veio, e inventar um mudaria o formato que o
painel le.

### O vazio do arquivo nunca apaga o que existe

Esta e a regra que da forma ao resto. A lista do fornecedor traz descricao
vazia, foto nenhuma e estoque zero em todas as linhas; o banco, depois de umas
semanas de painel, tem descricao escrita a mao, fotos subidas uma a uma e o
estoque contado na prateleira. Gravar o arquivo por cima apagaria tudo isso de
uma vez, em silencio.

| Campo                             | Numa reimportacao                          |
| --------------------------------- | ------------------------------------------ |
| `name`, `parentSlug`              | o arquivo manda                            |
| `priceCents`                      | o arquivo manda — **exceto** `0`           |
| `brand`, `description`, `images`, `tags`, `categorySlugs`, `label` | o arquivo manda quando traz algo; vazio preserva o banco |
| `stock`, `compareAtPriceCents`    | o arquivo manda quando traz algo; `0`/`null` preserva o banco |
| `isActive`, `isFeatured`, `isReadyToShip`, `allowBackorder` | so na criacao; depois sao do painel |
| `order` e `image` da categoria    | so na criacao; depois sao do menu do painel |

Zero nao e preco de nada: uma exportacao quebrada, cheia de zeros, nao pode
zerar o catalogo da loja. E o produto que a dona destacou na home continua
destacado, e o que ela tirou de linha nao volta a vender porque a lista do
fornecedor ainda o cita.

### Variantes casam pelo SKU

A variante que o arquivo traz e o banco tem e atualizada **no lugar**, com o
mesmo `_id` — e o `_id` que o pedido guarda em `items.variantId`, e troca-lo
quebraria a devolucao de estoque do cancelamento. A que so o arquivo traz
nasce. A que so o banco tem e **desativada, nunca apagada**, pelo mesmo motivo.

### Uma entrada ruim nao derruba as outras

Cada produto e validado pelo `CreateProductDto` e cada categoria pelo
`CreateCategoryDto` — os mesmos das rotas do painel, com as mesmas opcoes do
pipe global, nao uma copia. Reprovar vira uma linha no relatorio, com slug e
motivo, e a importacao segue para a proxima. Uma lista de 269 produtos com um
preco digitado errado precisa importar 268.

### Flags

```bash
npm run seed:catalog -- --dry-run            # simula e imprime o relatorio, sem gravar
npm run seed:catalog -- --only=asad-elixir   # um produto so, para testar
npm run seed:catalog -- --file=../lista.json # outro arquivo
```

`--only` limita os produtos; as categorias continuam entrando, senao o produto
escolhido nao teria onde se encaixar.

### O relatorio

```
Importacao concluida em 6.4s.
Categorias  21 criadas, 0 atualizadas, 0 com falha
Produtos    269 criados, 0 atualizados, 0 com falha
Variantes   269 criadas, 0 desativadas
Transacao   nao suportada por este cluster; gravado direto.

Falharam 1:
  asad-elixir: variants.0.priceCents: o preco deve ser um inteiro em centavos.
```

### Transacao, e o que fazer sem ela

Transacao no Mongo exige replica set. O Atlas tem, e la a importacao inteira
entra ou nao entra nada. Um `mongod` solto — o do desenvolvimento e o dos
testes — nao tem, e nesse caso a importacao grava direto e deixa os ids do que
criou em `.catalog-import/catalog-import-<timestamp>.json`, que e a unica forma
de desfazer uma importacao que parou no meio.

### Pela rota, para quem nao tem shell

```
POST /api/v1/admin/catalog/import?dryRun=true&only=<slug>
```

Restrita ao `SUPER_ADMIN`: uma importacao reescreve o preco do catalogo inteiro
numa chamada, o que a deixa um degrau acima de `MANAGES_STORE`, que edita
produto a produto. Faz o mesmo que o comando, a partir do mesmo servico, com
tres diferencas que a Vercel impoe:

- **Corpo ate 1 MB**, contra os 256 KB do resto da API. O teto sobe em um
  caminho so; subi-lo para toda rota custaria memoria e tempo de funcao em
  cada requisicao.
- **Lotes de 50 produtos**, com orcamento de tempo. Chegando no teto, a
  importacao para entre dois lotes — com produtos inteiros gravados — e
  devolve `remaining`. Como tudo e idempotente pelo slug, mandar o mesmo
  arquivo de novo termina o servico sem duplicar nada.
- **O log de rollback vai no corpo da resposta**, e nao em arquivo: nao ha
  disco para escrever na funcao.

O arquivo pode ser colado inteiro, com `$schema` e tudo. A chave iniciada por
cifrao seria recusada pelo guard de operadores do Mongo; ela e removida no
parser desta rota, no nivel de cima do corpo, sem abrir excecao na defesa
(ver `catalogImportParser` em [`src/bootstrap.ts`](src/bootstrap.ts)).

A importacao deixa uma entrada `catalog.imported` na trilha de auditoria, com
quem importou e os numeros do relatorio. Uma entrada por importacao, e nao uma
por produto: quem investiga um preco quer saber que o catalogo foi importado,
por quem e quando.

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

O repositorio e um monorepo, entao o projeto da Vercel aponta para a pasta, e
nao para a raiz. O caminho inteiro, na ordem:

**1. Importar.** Em *Add New > Project*, escolha o repositorio e, em
*Configure Project*, defina **Root Directory = `backend`**. Framework Preset
fica em *Other*: quem decide o que roda e o `vercel.json`, que reescreve toda
rota para `/api/index`. A versao do Node vem de `engines.node` no
`package.json` (o campo `functions.runtime` do `vercel.json` so aceita runtimes
de terceiros no formato `pacote@versao`).

**2. Nao reconstruir o que nao mudou.** O `vercel.json` ja traz

```json
"ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
```

Com o Root Directory em `backend`, esse `.` e a propria pasta: commit que so
toca o frontend sai com o build ignorado, e o deploy anterior continua
servindo. Em *Settings > Git > Ignored Build Step* a opcao equivalente e
*Only build if there are changes in the Root Directory* — o comando do
`vercel.json` tem precedencia, e os dois dizem a mesma coisa. Na duvida, o
comando falhando (por exemplo, num clone raso sem `HEAD^`) constroi: o lado
seguro do erro e publicar demais, nunca de menos.

**3. Variaveis de ambiente.** Em *Settings > Environment Variables*, para o
ambiente *Production* (e *Preview*, se for usar):

| Variavel | Obrigatoria | Observacao |
| --- | --- | --- |
| `MONGODB_URI` | sim | String do Atlas, com usuario e senha |
| `MONGODB_DB_NAME` | nao | `maison-essence` por padrao |
| `CORS_ORIGINS` | sim | Dominios da loja e do painel, um a um. `*` derruba o boot |
| `JWT_ACCESS_SECRET` | sim | 32+ caracteres |
| `JWT_REFRESH_SECRET` | sim | 32+, diferente do anterior |
| `JWT_CUSTOMER_ACCESS_SECRET` | sim | 32+, diferente dos dois |
| `JWT_CUSTOMER_REFRESH_SECRET` | sim | 32+, diferente dos tres |
| `CLOUDINARY_CLOUD_NAME` | nao | Sem ela, so `/admin/uploads` responde 503 |
| `CLOUDINARY_API_KEY` | nao | |
| `CLOUDINARY_API_SECRET` | nao | Nunca vai para o frontend |
| `DOCS_USER` | nao | Usuario do `/api/v1/docs` |
| `DOCS_PASSWORD` | nao | 12+ caracteres. Sem as duas, a documentacao nao sobe |
| `APP_VERSION` | nao | Aparece no `/health` |
| `BOOTSTRAP_SUPERADMIN_EMAIL` | so no primeiro deploy | Ver o passo 5 |
| `BOOTSTRAP_SUPERADMIN_PASSWORD` | so no primeiro deploy | 12+ caracteres |
| `BOOTSTRAP_SUPERADMIN_NAME` | nao | `Super Admin` por padrao |
| `BOOTSTRAP_SECRET` | so no primeiro deploy | 32+. **Sai do ambiente depois** |

O que cada uma faz em detalhe esta em "Variaveis de ambiente". Os cookies de
sessao saem com `SameSite=None; Secure` fora de desenvolvimento, o que exige
HTTPS — na Vercel isso ja e o padrao.

No Atlas, libere o acesso de rede. A Vercel nao publica faixa fixa de IP de
saida no plano gratuito, entao ou se usa `0.0.0.0/0` com usuario de banco forte
e escopo minimo, ou se contrata IP dedicado. Escolha a regiao da funcao
(*Settings > Functions*) na mesma regiao do cluster: cada ida ao banco atravessa
essa distancia, e ela aparece inteira no cold start.

**4. Validar o deploy.** Com a URL publicada:

```bash
npm run check:coldstart -- https://sua-api.vercel.app
```

O script chama `GET /api/v1/health` uma vez e mostra o tempo; depois chama mais
tres, ja com a instancia quente, para a comparacao. Ele falha quando a primeira
passa de **3 segundos**, quando o HTTP nao e 200 ou quando o banco nao responde
`connected`. Para medir um cold start de verdade, rode depois de alguns minutos
sem trafego — instancia quente responde em dezenas de milissegundos e nao prova
nada sobre o boot. O mesmo teto e verificado no CI, so que contra o boot local,
em [`test/serverless.e2e-spec.ts`](test/serverless.e2e-spec.ts).

Passando de 3 segundos, os suspeitos, em ordem: a regiao da funcao longe do
cluster, o Atlas em tier gratuito hibernando, e algum import pesado novo no
caminho do boot.

**5. Primeiro acesso e fechamento da porta.** Com as `BOOTSTRAP_*` definidas e
o deploy no ar:

```bash
curl -X POST https://sua-api.vercel.app/api/v1/auth/bootstrap \
  -H "x-bootstrap-secret: $BOOTSTRAP_SECRET"
```

Responde 201 com o usuario criado, 409 se ja houver alguem no banco e 404 se o
segredo nao estiver no ambiente. Feito isso:

1. entre no painel com o e-mail e a senha temporaria — o login responde 200 e o
   `/auth/me` traz `mustChangePassword: true`, e toda rota administrativa
   responde 403 ate a troca;
2. troque a senha em `PATCH /api/v1/auth/change-password`;
3. **remova `BOOTSTRAP_SECRET`** das variaveis da Vercel e refaca o deploy
   (*Deployments > ... > Redeploy*, ou um commit qualquer em `backend/`). Sem o
   segredo, a rota volta a responder 404. As `BOOTSTRAP_SUPERADMIN_*` podem sair
   junto: elas so servem para essa unica chamada, e deixa-las e manter uma senha
   em texto no painel do provedor.

Depois disso, `GET /api/v1/health` deve responder `status: ok` com
`database.status: connected`, e o login do super-admin deve funcionar exigindo
a troca de senha — que sao os tres criterios de aceite do deploy.

## Scripts

| Script             | O que faz                                  |
| ------------------ | ------------------------------------------ |
| `start:dev`        | Nest em watch mode na porta 3333           |
| `dev:vercel`       | `vercel dev` pelo handler serverless       |
| `build`            | Compila para `dist/`                       |
| `seed:superadmin`  | Cria o primeiro SUPER_ADMIN; idempotente   |
| `seed:demo`        | Popula catalogo, entrega e configuracoes   |
| `seed:catalog`     | Importa `catalog.json`; idempotente pelo slug |
| `typecheck`        | `tsc --noEmit`                             |
| `test`             | Testes unitarios                           |
| `test:e2e`         | Testes de ponta a ponta                    |
| `test:schemas`     | Insere e le um documento de cada colecao   |
| `test:cov`         | As duas suites juntas, com a meta de cobertura |
| `check:coldstart`  | Mede o cold start da URL publicada (ver "Deploy") |
| `lint`             | oxlint                                     |
