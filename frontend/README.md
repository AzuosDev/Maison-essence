# Maison Essence — loja

A loja em React. Consome a API de [`../backend`](../backend) e nao fala com
mais nada: nao ha banco, nao ha servidor proprio, nao ha rota de API aqui. O
build e um site estatico.

## Rodando

```bash
cd frontend
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

Sem `.env`, o desenvolvimento assume `http://localhost:3000/api/v1` — a API que
`npm run start:dev` do backend sobe — e desenha o placeholder no lugar das
imagens. No build de producao as duas variaveis sao obrigatorias e a aplicacao
recusa subir sem elas, dizendo qual falta.

| Variavel | Para que |
| --- | --- |
| `VITE_API_URL` | URL da API, com o prefixo `/api/v1` e sem barra no fim |
| `VITE_CLOUDINARY_CLOUD_NAME` | Conta do Cloudinary, para montar a URL das fotos |

Nada com o prefixo `VITE_` e segredo: vai no bundle, em texto puro, visivel
para qualquer visitante. A API key e a secret do Cloudinary ficam no backend.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de producao em `dist/` |
| `npm run preview` | Serve o `dist/` como a Vercel serviria |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b`, sem emitir |
| `npm test` | Vitest |

## Estrutura

```
src/
├── app/          router, providers, layouts e boundaries de erro
├── pages/        uma pasta por rota
├── components/
│   ├── ui/       primitivos do design system (nao conhecem a loja)
│   ├── store/    componentes da loja
│   └── admin/    componentes do painel
├── features/     cart, checkout, auth, catalog
├── lib/          cliente HTTP, formatadores, Cloudinary, env
└── styles/       tokens, reset, tipografia
```

A regra de dependencia: `lib` nao importa nada; `features` importa `lib`;
`components` importa `lib` e `features`; `pages` e `app` importam tudo. Import
no sentido contrario e sinal de que algo esta na pasta errada.

## Design system

Os primitivos estao em [`src/components/ui`](src/components/ui), um CSS Module
por componente: Button, Input, Select, Textarea, Checkbox, Radio, Badge, Chip,
Card, Modal, Drawer, Skeleton, Spinner, Toast, Tabs, Accordion, Breadcrumb,
Pagination e EmptyState. Nenhuma biblioteca de componentes — o que ha e HTML
nativo, CSS Modules e os tokens.

Tres regras valem para todos: encaminham `ref`, aceitam `className` e herdam
os tipos do elemento nativo (`ComponentPropsWithoutRef`), de modo que
`autoComplete`, `maxLength` e `aria-*` funcionam sem precisar ser
redeclarados.

**`npm run dev` e abra `/styleguide`.** E a bancada de revisao: todo primitivo,
em todos os estados, na mesma tela — junto das cores, da escala tipografica e
da escala de espaco. A rota so existe em desenvolvimento; no build de producao
o `import.meta.env.DEV` vira `false` e o Rollup remove a pagina inteira do
bundle.

### A linguagem da vitrine

Tres regras explicam quase todo CSS da loja:

**Fundo branco, laje preta.** A pagina e branca (`--bg`); areia clara
(`--bg-alt`) separa secoes; e os blocos pretos — barra de avisos, barra do
menu, rodape — saem de `--slab`, que e um par proprio e nao inverte com o
tema. Texto secundario sobre a laje usa `--slab-muted`, nunca `--muted`:
aquele cinza e calibrado contra o branco e reprova o contraste contra o
preto.

**O que e dourado se clica.** `--gold` e a cor da acao — botao primario, o
quadrado da lupa na busca, o filete do item ativo do menu, o preenchimento
da regua de beneficios. Titulo, filete decorativo e borda de cartao nao sao
dourados. Quando o dourado precisa virar texto (o "20% OFF" ao lado do
preco), quem entra e `--gold-deep`, que tem 4.7:1 sobre o branco; e o que vai
**por cima** do dourado e `--on-gold`, um valor literal que nao inverte com o
tema — `--ink` ali daria texto claro sobre dourado no tema escuro.

**Uma fonte para a interface, uma para a marca.** `--font-body` (Onest,
tambem apontado por `--font-display`) desenha titulo, nome de produto, preco,
botao e formulario; o que separa titulo de texto e peso e corpo, nao familia.
`--font-brand` (Cormorant Garamond) existe para uma coisa so: a assinatura
"MAISON ESSENCE" do cabecalho e do rodape — e logotipo, nao tipografia de
interface. O nome das marcas na faixa da home ficou em Onest caixa alta com
espacejamento aberto: em Cormorant, dez nomes de fabricante em sequencia
leem como dez assinaturas, e a marca da loja perde o que a distingue. O
porque esta em `pages/home/brand-row.module.css`.

### Tokens

Cor, tipografia, espaco, raio, sombra e duracao saem de
[`src/styles/tokens.css`](src/styles/tokens.css), e so de la: nenhum CSS
Module do projeto escreve um hexadecimal. Para conferir:

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgba?\(" src --include="*.module.css"
```

Os poucos tokens que nao estao na especificacao — o veu do modal, o fundo
lavado do toast — sao os da paleta com transparencia, e a derivacao esta
escrita ao lado de cada um.

Mobile first, com quatro respiros: 640px (`40rem`), 768px (`48rem`), 1024px
(`64rem`) e 1280px (`80rem`). Toda media query e `min-width`.

## Moldura da loja

O layout base — barra de avisos, cabecalho, rodape e o botao do WhatsApp —
esta em [`src/components/store`](src/components/store) e e montado por
[`store-layout.tsx`](src/app/layouts/store-layout.tsx). A area da conta do
cliente usa a mesma moldura: para quem esta comprando, "meus pedidos" e uma
pagina da loja, nao outro site.

**Uma chamada por dado.** O `StoreSettingsProvider` fica no topo do layout e
busca `GET /settings` e `GET /pages` uma vez; cabecalho, rodape, barra de
avisos e o botao do WhatsApp leem do contexto. A arvore de categorias
(`GET /categories`) segue a mesma regra pelo `useCategoryTree`. Ha teste
contando as requisicoes.

**O cabecalho** fica fixo (`sticky`, nao `fixed` — assim ele ocupa espaco no
fluxo e dispensa um `padding-top` compensatorio) e encolhe ao rolar: a banda
da marca perde respiro e o logo passa de empilhado para em linha. Quem decide
e o `useScrolled`, que devolve um booleano e le a posicao dentro de um
`requestAnimationFrame`. A troca e instantanea, sem transicao: o cabecalho
esta no fluxo, e animar a altura dele obrigaria o navegador a recalcular a
pagina inteira a cada quadro, justamente enquanto a pessoa rola.

A banda e uma **grade de areas nomeadas**, e e so por isso que o mesmo markup
tem dois arranjos: no celular, `menu · marca · acoes` com a busca numa
segunda fileira de ponta a ponta; no desktop, `marca · busca · acoes` numa
linha so. A busca e um elemento unico nos dois — dois botoes no markup seriam
dois alvos de teclado para a mesma sobreposicao.

**A faixa preta do menu**, abaixo da banda, so existe a partir de 1024px e
nao encolhe junto: a navegacao sumia justamente quando o cliente comecava a
procurar outra coisa. Ela carrega Categorias, Produtos, Pronta Entrega e,
acima de 1280px, as paginas institucionais vindas de `GET /pages` — "trocas e
devolucoes" e "como comprar" sao as perguntas de quem nunca comprou aqui, e
deixa-las so no rodape e pedir que essa pessoa role a loja inteira.

**O menu de Categorias** abre um painel em largura total. Ele e filho do
`<header>`, e nao do container de 1280px, porque precisa se esticar de ponta
a ponta. Nao e um dialogo e nao prende o foco; o Escape e o clique fora sao
tratados pelo cabecalho, e so enquanto ele esta aberto.

**No celular** o caminho e a gaveta (`Drawer` do design system, com foco
preso e Escape ja prontos): busca no topo, categorias em acordeao e links
institucionais no fim. O menu horizontal so aparece a partir de 1024px.

**A busca** abre em tela cheia, sugere a partir de 3 letras com 300ms de
espera e guarda as buscas recentes so no `localStorage` deste navegador —
nao vao para a API nem se ligam a conta nenhuma.

### Tres pontos sem backend

Os tres estao marcados no codigo e desenhados para falhar de forma honesta,
em vez de fingir que funcionam:

- **Newsletter** ([`features/settings/newsletter.ts`](src/features/settings/newsletter.ts)):
  nao existe rota de inscricao na API. O formulario valida e envia, mas a
  chamada recusa com uma mensagem que manda o cliente para o WhatsApp.
  Quando a rota existir, e uma linha para ligar.
- **CNPJ do rodape** ([`components/store/store.constants.ts`](src/components/store/store.constants.ts)):
  `GET /settings` nao devolve CNPJ nem razao social. As constantes nascem
  vazias e o rodape esconde a linha enquanto estiverem assim — um CNPJ
  inventado no ar e pior do que nenhum.
- **Brinde por valor de compra** (`GIFT`, no mesmo arquivo): a loja da brinde
  a partir de um valor, mas nao ha campo em `StoreSettings` nem regra no
  carrinho. A regua da sacola ([`cart-rewards.tsx`](src/components/store/cart-rewards.tsx))
  desenha o degrau do frete gratis, que vem de `freeShippingMinCents`, e so
  desenha o do brinde quando `GIFT.minCents` e `GIFT.label` estiverem
  preenchidos — e eles nascem vazios. Enquanto for constante, mudar o valor
  exige deploy; quando o backend ganhar os campos, a troca e de uma linha.

### Acessibilidade

O que nao da para conferir a olho tem teste
([`dialog.spec.tsx`](src/components/ui/dialog.spec.tsx),
[`navigation.spec.tsx`](src/components/ui/navigation.spec.tsx)):

- Modal e Drawer prendem o foco, fecham no Escape e devolvem o foco ao botao
  que abriu. Os tres comportamentos vem do mesmo hook, `useDialog`.
- Nas Tabs, as setas trocam de aba e so a selecionada esta na ordem do Tab.
  Na sanfona, as setas movem entre os gatilhos. `Home` e `End` vao as pontas
  nos dois.
- O anel de foco dourado de 2px nunca e removido, so redesenhado. Sobre fundo
  escuro, a classe `on-dark` troca a cor do anel para `--gold`.

## Decisoes que valem para tudo

**Um cliente HTTP.** Nenhum `fetch` solto: tudo passa por `lib/http`. Ele
anexa o access token, e num `401` renova a sessao uma vez e refaz a
requisicao. Chamadas simultaneas que tomam `401` compartilham uma renovacao so
— o backend rotaciona o refresh token a cada uso e trata reuso como sinal de
roubo, entao dois refreshes em paralelo derrubariam a sessao. O teste em
`lib/http/client.spec.ts` existe por causa disso.

**Duas sessoes, nao uma.** Painel e loja tem tokens, cookies e rotas de
renovacao diferentes, e convivem no mesmo navegador — a dona compra na propria
loja. Cada uma tem o seu store (`features/auth`) e a sua chave no
`localStorage`.

**Dinheiro em centavos, sempre.** O valor viaja e e calculado como inteiro;
quem desenha chama `formatCents`. Nenhum componente divide por cem nem escreve
`R$` na mao. Os formatadores estao em `lib/format` — moeda, telefone e data.

**A sacola e do cliente, o total e do servidor.** O carrinho vive no navegador
(`features/cart`, persistido). O preco guardado nele serve para o resumo
lateral e nada mais: quem diz quanto custa e `POST /cart/quote`.

**Imagem pelo `publicId`.** O backend guarda o identificador do Cloudinary, e
as duas pontas montam a URL com a mesma regra (`lib/cloudinary`), nos presets
`thumb`, `card` e `detail`. Divergir ai custa o cache do CDN.

**Tokens de estilo, nao valores soltos.** Cor, fonte, espaco, raio e sombra
saem de `styles/tokens.css`. O resto e CSS Module com escopo no componente.

**Um boundary de erro por rota.** Um erro na pagina do produto troca o miolo e
deixa cabecalho, rodape e sacola de pe, em vez de apagar a loja.

## Deploy

Projeto proprio na Vercel, com *Root Directory* apontado para `frontend`. O
`vercel.json` daqui faz o rewrite de toda rota para o `index.html` — sem ele,
abrir `/painel` direto no navegador daria 404 — e marca os arquivos com hash
como imutaveis.
