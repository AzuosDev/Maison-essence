# maison-essence-api

Casca do backend da Maison Essence: NestJS em TypeScript estrito, preparado para
rodar como uma unica funcao serverless na Vercel.

Ha conexao com MongoDB via Mongoose e os schemas do dominio ja estao
modelados. Ainda nao ha rotas de negocio nem autenticacao.

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
| `MONGODB_URI`  | **sim**     | —             | `mongodb://` ou `mongodb+srv://`         |
| `MONGODB_DB_NAME` | nao      | `maison-essence` | Nome do banco                         |

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

Dez colecoes, cada uma no diretorio do seu dominio em
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

Defina `CORS_ORIGINS` e `MONGODB_URI` (e `APP_VERSION` / `MONGODB_DB_NAME`, se
quiser) nas variaveis de ambiente do projeto na Vercel.

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
