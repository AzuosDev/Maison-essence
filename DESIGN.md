---
name: Maison Essence
description: A loja popular brasileira de perfume importado, executada com acabamento de catálogo — branco dominante, laje preta, dourado só na ação.
colors:
  ink: "#121212"
  ink-soft: "#4a4a4a"
  muted: "#6b6660"
  bg: "#ffffff"
  bg-alt: "#f7f5f1"
  surface: "#ffffff"
  line: "#e6e2da"
  gold: "#c39540"
  gold-press: "#a97c2b"
  gold-deep: "#9e6917"
  on-gold: "#121212"
  success: "#2e7d5b"
  danger: "#b3261e"
  slab: "#121212"
  slab-ink: "#ffffff"
  slab-muted: "color-mix(in srgb, #ffffff 70%, #121212)"
  overlay: "rgb(10 10 10 / 0.52)"
  whatsapp: "#25d366"
typography:
  display:
    fontFamily: "Readex Pro, Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Readex Pro, Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Readex Pro, Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  price:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tabular-nums"
  label:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
  brand:
    fontFamily: "Cormorant Garamond, Georgia, Times New Roman, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.24em"
rounded:
  chip: "4px"
  card: "8px"
  button: "8px"
  modal: "12px"
  pill: "999px"
spacing:
  "4": "0.25rem"
  "8": "0.5rem"
  "12": "0.75rem"
  "16": "1rem"
  "24": "1.5rem"
  "32": "2rem"
  "48": "3rem"
  "64": "4rem"
  "96": "6rem"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 1.5rem"
    height: "3rem"
  button-primary-hover:
    backgroundColor: "{colors.gold-press}"
    textColor: "{colors.on-gold}"
  button-primary-disabled:
    backgroundColor: "{colors.bg-alt}"
    textColor: "{colors.muted}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 1.5rem"
    height: "3rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.button}"
    padding: "0 0.75rem"
    height: "2.25rem"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.button}"
    padding: "0 1.5rem"
    height: "3rem"
  badge-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.5rem"
  badge-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.5rem"
  badge-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.5rem"
  badge-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.5rem"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.button}"
    padding: "0 0 0 1rem"
    height: "3rem"
  search-submit:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    height: "3rem"
    width: "3rem"
  nav-link:
    backgroundColor: "{colors.slab}"
    textColor: "{colors.slab-ink}"
    typography: "{typography.label}"
    padding: "0 0.75rem"
    height: "2.75rem"
  card-promo-flag:
    backgroundColor: "{colors.slab}"
    textColor: "{colors.slab-ink}"
    typography: "{typography.label}"
    padding: "0.25rem 0.5rem"
  container:
    width: "1280px"
    padding: "0 1.5rem"
---

# Design System: Maison Essence

## Overview

**Creative North Star: "A Vitrine de Rua, Bem Impressa"**

É a loja popular brasileira de perfume importado — o arranjo que a cliente já
percorre de olhos fechados: faixa de avisos preta rolando, busca larga com
botão dourado, barra preta de navegação, banner, categorias em círculo, três
fileiras de produto. O que separa esta loja das vizinhas do segmento não é a
forma, é o acabamento: grade sem buraco, cartão de altura única, selo legível,
foto sobre branco, nenhuma região morta. A convenção é escolha explícita da
dona e compromisso permanente; o trabalho visual executa essa convenção com
rigor, sem ironia e sem contrabandear um mundo próprio por cima dela.

A página é branca de ponta a ponta. Areia clara (`bg-alt`) separa seções que
seriam vizinhas de mesmo tom; tinta quase preta (`slab`) corta a página em três
lugares e só três — avisos, menu, rodapé. O dourado da marca é a única cor de
ação: botão de comprar, quadrado da lupa, filete do item ativo, preenchimento da
régua de benefícios. Nada mais é dourado — nem título, nem filete decorativo,
nem borda de cartão. Verde e vermelho entram em dose de selo, nunca de
superfície.

A densidade é comercial e deliberada: seis linhas por cartão (marca, nome, preço
de antes, preço de agora, parcela, ação), todas alinhadas à esquerda, todas na
mesma régua vertical da página. A separação é por filete de 1px e por tom de
fundo, como catálogo impresso faz — não por sombra, não por moldura, não por
gradiente decorativo. A loja anterior era creme com serifada dourada fina, muito
ar e quase nenhuma informação comercial; esse mundo está recusado por decisão
registrada da dona.

**Key Characteristics:**
- Branco dominante como chão; areia clara só para separar seções.
- Laje preta em três lugares fixos: avisos, menu, rodapé.
- Dourado é ação, nunca decoração nem título.
- Readex Pro no corpo grande, Onest em tudo que se lê de perto; a serifada é
  só a assinatura.
- Cartão sem moldura: o que separa é o espaço e o canto da própria foto.
- Régua única à esquerda — todo conteúdo da página começa na mesma vertical.
- Altura de cartão igual em toda fileira, por reserva de linha e não por sorte.
- Uma sombra só, e ela não cai em cartão de produto.

## Colors

Paleta de duas cores de verdade — a tinta e o dourado da marca — sobre um
branco que é chão, com verde e vermelho reservados ao tamanho de um selo.

### Primary
- **Dourado da Marca** (`gold`): a cor da ação, tirada da própria logo. Botão
  primário preenchido, quadrado da lupa na busca, filete sob o item ativo do
  menu, preenchimento da régua de benefícios, pontos do carrossel, moldura dos
  ícones de confiança sobre a laje. Dá 2.4:1 sobre o branco: nunca é texto.
- **Dourado Pressionado** (`gold-press`): o segundo tom do botão preenchido, no
  hover e no clique. Nasce como token porque clarear não serve — o dourado já é
  claro — e porque o tema escuro quer outro valor.
- **Dourado Escurecido** (`gold-deep`): o dourado quando ele precisa virar
  texto ou traço fino — o "14% OFF" ao lado do preço, o filete da aba ativa, a
  inicial da categoria sem foto, o anel de foco sobre fundo claro. 4.7:1 sobre
  o branco.
- **Tinta Sobre Ouro** (`on-gold`): o que vai por cima do dourado — rótulo do
  botão primário, desenho da lupa, texto do selo dourado. 6.9:1 sobre `gold`,
  5.0:1 sobre `gold-press`.

### Secondary
- **Verde da Promessa** (`success`): selo "Pronta entrega" e fundo lavado do
  aviso de sucesso. Dose de selo, nunca de superfície.
- **Vermelho do Impedimento** (`danger`): selo "Esgotado", contorno do botão
  destrutivo, mensagem de erro de formulário. Contornado, nunca preenchido num
  botão.
- **Verde do Canal** (`whatsapp`): o verde oficial do WhatsApp no botão
  flutuante. Não é token de marca — é a cor do canal, e muda se o canal mudar.

### Neutral
- **Tinta** (`ink`): título, nome de produto, preço de agora, texto forte.
  17.4:1 sobre o branco.
- **Tinta Suave** (`ink-soft`): corpo de texto, rótulo de aba, link de
  navegação secundária, fio de pão. 8.9:1.
- **Cinza Legítimo** (`muted`): a linha de apoio da seção, o preço riscado, a
  parcela, o rótulo da marca acima do nome. 5.7:1 — subiu na troca do creme
  pelo branco justamente para que rótulos de 12px não precisassem virar tinta
  cheia e achatar a hierarquia.
- **Branco da Página** (`bg`) e **Branco de Superfície** (`surface`): o chão da
  loja e o fundo de campo, seta e cartão de degrau.
- **Areia** (`bg-alt`): fundo de seção alternada, fundo do esqueleto, moldura
  da foto antes dela chegar, botão primário desabilitado.
- **Filete** (`line`): a única separação horizontal da vitrine, 1px.
- **Laje** (`slab`) / **Tinta da Laje** (`slab-ink`) / **Apagado da Laje**
  (`slab-muted`): o par próprio dos blocos escuros — barra de avisos, barra do
  menu, rodapé, faixa de desconto progressivo na quina da foto.
- **Véu** (`overlay`): atrás do modal e da gaveta. Sempre escuro, nos dois
  temas; o que muda é a força.

### Named Rules

**A Regra do Ouro Clicável.** O que é dourado nesta loja se clica ou se ganha.
Título, filete decorativo e borda de cartão não são dourados. Auditoria de uma
frase: aponte qualquer elemento dourado da tela e diga o que acontece ao
clicar nele — se a resposta for "nada", ele está errado.

**A Regra do Dourado Que Não É Texto.** `gold` nunca pinta texto: 2.4:1 sobre
o branco. Onde a loja precisa escrever em dourado, quem entra é `gold-deep`.

**A Regra do Literal Sobre Ouro.** `on-gold` é valor literal e fica fora dos
blocos de tema. O dourado da marca não muda com o tema, então o que vai por
cima dele também não pode mudar — `ink` ali daria texto claro sobre dourado no
escuro, 2.4:1.

**A Regra da Laje.** Bloco escuro é `slab` + `slab-ink`, nunca `ink` com `bg`
por cima: `ink` é primeiro plano e inverte, e o rodapé sairia claro no pé de
uma página escura. Texto secundário sobre a laje é `slab-muted` e nunca
`muted` — aquele cinza é calibrado contra o branco e dá 3.3:1 contra o preto.

**A Regra do Hexadecimal Proibido.** Nenhum CSS Module da vitrine escreve uma
cor nova. Cor com transparência se escreve com `color-mix` sobre o token, e não
com o hexadecimal dele repetido dentro de um `rgb()`: o valor escrito à mão não
acompanha o tema escuro.

## Typography

**Fonte de Interface:** Onest (com `system-ui`, `-apple-system`, `Segoe UI`)
**Fonte de Display:** Readex Pro (com Onest e a pilha do sistema atrás)
**Fonte da Marca:** Cormorant Garamond (com Georgia, Times New Roman)
**Fonte Mono:** pilha do sistema (`ui-monospace`, SFMono-Regular, Menlo,
Consolas), só para identificador que se lê caractere a caractere

**Caráter:** Duas grotescas com trabalhos separados. Onest é a de numeral alto
e aberto, com `tabular-nums` de verdade — que é o que uma loja de preço precisa
antes de precisar de personalidade — e desenha tudo que se lê de perto. Readex
Pro é mais larga e mais arredondada, e entra só no corpo grande: é ela que
separa "o que a seção se chama" de "o que está à venda". A serifada sobrou para
uma linha só: a assinatura da marca.

As três são auto-hospedadas pelo `@fontsource` e importadas em `main.tsx`, e
saem no próprio bundle. Não há `<link>` para o Google em lugar nenhum, e isso é
decisão, não esquecimento: fonte de outro domínio é uma conexão a mais antes da
primeira pintura, e uma dependência de terceiro no caminho crítico de uma loja
que vende pelo celular. Só os pesos que o sistema escreve são importados —
Onest 400/500/600/700, Readex Pro 400/600, Cormorant Garamond 600.

Escala: 64 / 48 / 36 / 28 / 22 / 18 / 16 / 14 / 12.

### Hierarchy
- **Display** (600, 2.25rem no desktop e 1.75rem no celular, 1.15, -0.015em):
  `h1` — título da página de catálogo, nome do produto na página de produto.
- **Headline** (600, 1.75rem no desktop e 1.375rem no celular, 1.2, -0.015em):
  `h2` e o título de seção da vitrine — "Mais vendidos", "Aproveite nossas
  promoções".
- **Title** (600, 1.375rem desktop / 1.125rem base, 1.2): `h3`, legenda do
  cartaz de coleção, título de bloco.
- **Body** (400, 1rem, 1.6): texto corrido. A legenda de seção fica em 0.875rem
  e para em 48ch, porque é legenda e não parágrafo.
- **Price** (700, 1.125rem no cartão e 2.25rem no destaque, 1.2, `tabular-nums`
  pela utilitária global `.tabular`): o preço de agora.
- **Label** (500, 0.75rem, 0.02em, caixa alta): a marca acima do nome, o rótulo
  do botão e da aba, o link da barra preta, a faixa de desconto progressivo.
- **Brand** (Cormorant Garamond 600, 1.125rem, 0.24em, caixa alta): a
  assinatura "MAISON ESSENCE" ao lado do monograma, e só ela.

### Named Rules

**A Regra das Três Vozes.** Cada família tem um trabalho, e nenhuma faz o da
outra. **Readex Pro** fala no corpo grande: `h1`, `h2`, `h3`, título de seção,
nome do produto na página dele. **Onest** fala em tudo que se lê de perto —
nome de produto no cartão, preço, parcela, rótulo, botão, menu, formulário,
texto corrido. **Cormorant Garamond** existe para a assinatura "Maison
Essence", e quem a escrever em qualquer outro lugar está reabrindo uma
discussão que esta loja já fechou: os nomes dos fabricantes na faixa da home
saíram da serifada de propósito, porque emprestá-la fazia oito marcas de
terceiros falarem com a voz da casa.

O corte entre as duas grotescas é por corpo, não por papel: a Readex não desce
para 14px, onde a diferença entre as duas desaparece e ela viraria a Onest com
outro nome.

**A Regra do Rótulo Que Rotula.** O rótulo em caixa alta nomeia um dado —
"LATTAFA" sobre o nome do perfume é a marca. Nunca acima de um título de seção:
uma linha curta em caixa alta pendurada sobre um `h2` para anunciá-lo é
decoração, e o título já carrega o próprio peso.

**A Regra do Numeral Fixo.** Todo número de dinheiro leva `.tabular`. Sem
`tabular-nums` o `1` é mais estreito que o `8` e os preços dançam verticalmente
na grade.

**A Regra do Espacejamento Negativo.** Título de seção é grande e em grotesca
pesada, e tipo grande pede espacejamento mais fechado (-0.015em), não mais
aberto. O positivo que existia servia à caixa alta de uma serifada que não está
mais aqui.

## Layout

Mobile first, quatro respiros, todos `min-width`: **640px** (`40rem`, duas
colunas), **768px** (`48rem`, o gutter passa de 16px para 24px), **1024px**
(`64rem`, a barra preta do menu aparece), **1280px** (`80rem`, a largura máxima
do container). `@media` não lê `var()`, então os respiros são rem escritos em
cada arquivo — não há token de breakpoint.

O container tem **1280px** de largura útil, centrado, com o gutter do token por
dentro. Cabe a grade de quatro colunas da vitrine com folga: cada coluna fica
com 290px, mais larga que os 227px que a quinta coluna do arranjo anterior
deixava para o nome do produto.

O cabeçalho é `sticky` (não `fixed`, para ocupar espaço no fluxo e dispensar
`padding-top` compensatório) e encolhe ao rolar — 5rem em repouso, 3.75rem
encolhido, ambos em token porque o `scroll-padding-top` das âncoras precisa da
mesma medida. A barra preta do menu (2.75rem) só existe a partir de 1024px e
não encolhe junto. A barra de avisos (2.25rem) rola junto com a página e não
gruda.

Ritmo vertical: seção de prateleira respira 48px em cima e embaixo no celular,
64px a partir de 1024px. A primeira prateleira da home, logo abaixo do banner,
usa 24px — contra uma foto escura de ponta a ponta o respiro cheio não separa
nada, só empurra o produto para fora da primeira tela.

### Named Rules

**A Regra do Corredor.** `container-max` é 1280px, e os 80px que sobram de cada
lado em 1440 não são sobra: são exatamente o corredor do botão flutuante do
WhatsApp — 24px de borda mais 56px de diâmetro. Com os 1360px anteriores a
margem tinha 40px e o círculo verde avançava por cima da última coluna, cobrindo
o canto do "Adicionar" do quinto cartão. Alargar o container reabre esse defeito.

**A Regra da Régua da Esquerda.** Todo conteúdo da página começa na mesma
vertical. Prateleira que sangra até a borda da tela recupera a régua no desktop
com `padding-inline: max(var(--gutter), calc((100vw - var(--container-max)) / 2
+ var(--gutter)))` — e o `+ gutter` não é detalhe, é o que faz o primeiro cartão
nascer na vertical do título. O `scroll-padding-inline` acompanha o mesmo valor,
senão o encaixe do `scroll-snap` ignora o respiro e a fileira nasce rolada.

**A Regra do Cartão de Medida Única.** O cartão tem a mesma medida em toda a
página: `flex: 0 0 X`, nunca `flex-grow`. Três coisas disputam a linha e só duas
cabem — medida única, fileira na régua, nenhum vão no fim quando a prateleira é
curta. As duas primeiras ganham.

**Duas colunas no celular, quatro a partir de 768px**, e a medida é calculada,
não uma porcentagem redonda: `calc((100% - vãos) / n)` desconta os `gap` antes
de dividir, então n cartões e n-1 vãos ocupam a largura exata do trilho. Com
porcentagem solta — os 58% / 30% / 23% / 18.4% que estavam aqui — a conta não
fecha com o vão e o último cartão da tela nasce cortado por alguns pixels, que
é o que faz uma fileira parecer desalinhada sem que se saiba por quê.

A contagem vale para as duas formas de prateleira, e é por isso que a grade
empilhada usa os mesmos dois respiros: a mesma loja não pode mostrar o mesmo
cartão em dois tamanhos na mesma rolagem.

**A Regra do Trilho Contêiner.** Todo trilho que rola na horizontal leva
`position: relative`. Sem bloco contêiner, um descendente absoluto — e
`.visually-hidden` é um — toma o ICB como referência, escapa do `overflow:
hidden` e estica a página inteira: um "De " de preço riscado no sexto cartão já
deu 862px de rolagem horizontal ao documento.

**A Regra do Pé do Preço.** O bloco de preços reserva a linha do riscado
(`min-height: 2.5rem`) e ancora o conteúdo pelo pé (`align-content: flex-end`),
para que o preço caia na mesma altura em toda a fileira, tenha o produto
desconto ou não. A parcela também tem altura reservada (`min-height: 1.125rem`)
porque as regras de pagamento chegam depois do produto.

## Elevation & Depth

A vitrine é plana. Separação é por **filete de 1px** (`line`) e por **tom de
fundo** (branco contra areia, branco contra laje preta) — que é como catálogo
impresso faz. Cartão de produto não tem sombra, não tem borda e não tem fundo
próprio: o que separa um cartão do vizinho é o espaço entre eles e o canto
arredondado da própria foto. Dez retângulos desenhados numa vitrine de dez
produtos criariam dez molduras competindo com dez fotos, e a foto é o produto.

A profundidade existe para o que de fato flutua, e há **uma sombra só** no
sistema.

### Shadow Vocabulary
- **A sombra do que flutua** (`box-shadow: 0 1px 2px rgb(18 18 18 / 0.05), 0
  10px 30px rgb(18 18 18 / 0.08)`): gaveta, modal, menu suspenso, painel de
  categorias, seta da prateleira, botão do WhatsApp. No tema escuro ela
  escurece e ganha força; é o único token de sombra do projeto.

### Named Rules

**A Regra do Plano.** Superfície de conteúdo é plana. Sombra só em elemento que
sai do fluxo e paira sobre a página. Não existe sombra colorida e não existe
segundo nível de elevação.

**A Regra do Gradiente de Serviço.** Não há gradiente decorativo: nenhuma
superfície, botão, cartão ou faixa tem gradiente de fundo. Gradiente aparece em
dois usos funcionais, e só neles — o véu (`scrim`) que garante contraste do
texto sobre foto de banner e de cartaz, e o brilho que atravessa o esqueleto de
carregamento. Fora disso, cor chapada.

## Shapes

Uma língua de cantos só. **8px** é o raio do cartão, do campo e do botão —
`radius-button` é token próprio (e não `radius-card` escrito no botão) porque é
decisão de linguagem, não coincidência de valor. A pílula, que era a assinatura
do mundo anterior, saiu dos botões: numa grade onde cada cartão termina num
botão dourado de largura total, oito pílulas seguidas desenhavam oito comprimidos
na vitrine.

**4px** (`chip`) é o canto pequeno: esqueleto, degrau de desconto, realce de
foco de link de texto. **12px** (`modal`) é o modal. **999px** (`pill`) sobrou
para o que é genuinamente redondo: selo, círculo de categoria, moldura de
ícone, seta da prateleira, botão flutuante.

Borda é sempre `1px solid line` — o token `--border` existe para que ninguém
invente uma espessura. A única exceção de forma é a faixa de desconto
progressivo colada na quina da foto, com raio assimétrico (`0 4px 0 8px`): o
canto de baixo repete o raio do cartão, o de cima arredonda como chip, e os
outros dois ficam retos, para a etiqueta tomar a própria moldura como apoio em
vez de flutuar no meio de um recorte de fundo branco.

A foto do cartão é **quadrada** (1:1) — frasco é retrato, vela é quase cubo,
kit é paisagem, e o quadrado é a única proporção em que os três convivem numa
linha sem que um saia cortado. O cartaz de coleção é 16:9 e o banner de arte
inteira é 1920×562,283, a medida que a loja pediu.

Foco é um anel dourado de 2px com 2px de deslocamento, em `:focus-visible`,
declarado uma vez no reset. Sobre fundo escuro a classe `.on-dark` troca só a
cor do anel; sobre o botão dourado, o próprio botão troca para a tinta.

## Components

### Buttons
- **Forma:** canto de 8px, altura de 48px, caixa alta, 0.02em de espacejamento.
  O que muda entre variantes é o preenchimento, nunca a forma.
- **Primary:** dourado cheio com a tinta por cima. Hover e clique vão para
  `gold-press`. O anel de foco troca para `on-gold`, senão o anel dourado
  sumiria dentro do próprio botão.
- **Primary desabilitado:** areia com cinza, `opacity: 1`. Não é um dourado
  desbotado — "Esgotado" em dourado claro no meio de uma fileira de botões
  dourados lê como "clicável, só que longe".
- **Secondary:** contornado em tinta, fundo transparente; no hover inverte para
  tinta cheia com texto claro.
- **Ghost:** sem caixa, 36px de altura, caixa baixa, peso 500. Hover acende o
  lavado dourado com texto `gold-deep`.
- **Danger:** contornado em vermelho, nunca preenchido. O vermelho cheio puxa o
  olho para a ação mais perigosa da tela e a transforma no caminho óbvio.
- **Block:** o único que pode quebrar linha. O `nowrap` do botão comum, num
  botão de largura total, fixa a largura mínima no comprimento do rótulo e
  alarga o cartão inteiro.
- **Carregando:** o rótulo fica no lugar, invisível, segurando a largura; o
  círculo gira por cima. Desabilitado e carregando têm a mesma aparência de
  propósito.

### Badges
- **Estilo:** pílula, 12px, caixa alta, peso 600, 4px por 8px de preenchimento.
- **Significado pela cor:** tinta é informação ("-33%"), verde é promessa
  ("Pronta entrega"), vermelho é impedimento ("Esgotado"), dourado é seleção da
  casa, areia é apoio no painel.
- **Posição no cartão:** empilhados na quina superior esquerda da foto, 8px da
  borda, alinhados à esquerda.

### Cards
- **Cartão de produto:** sem moldura — nem borda, nem fundo, nem canto em volta
  do conjunto. Foto quadrada com raio de 8px, conteúdo alinhado à esquerda em
  seis linhas (marca, nome, preço de antes, preço de agora, parcela, ação). O
  nome tem no máximo duas linhas e altura mínima de duas linhas. O bloco
  comercial leva `margin-top: auto`, que é o que iguala a altura dos cartões da
  fileira.
- **Hover:** a foto avança 4% em 540ms (três vezes a duração base — 180ms numa
  foto de 300px lê como solavanco) e a segunda foto, se existir, entra em
  fundido. Produto esgotado perde a cor (`grayscale(1)`, 60% de opacidade).
- **Dois alvos declarados:** a foto e o nome levam ao produto, o botão põe na
  sacola. Não há `::after` absoluto cobrindo o cartão inteiro, porque ele
  cobriria o botão de comprar.

### Inputs
- **Estilo:** campo branco com borda de 1px em `line`, canto de 8px, altura de
  48px, texto de 14px.
- **Busca:** o botão da lupa encosta na borda direita do campo — quadrado
  dourado de 48px, com o raio interno em `calc(radius-button - 1px)` para
  assentar dentro da borda. Hover no campo inteiro escurece o quadrado.
- **Foco:** anel dourado de 2px, nunca removido.

### Navigation
- **Barra preta do menu (≥1024px):** laje com links de 12px em caixa alta,
  altura de 2.75rem, texto `slab-ink`. Hover acende um branco a 8%; o item
  ativo (e o menu aberto) ganha filete dourado de 2px embaixo. As páginas
  institucionais entram a partir de 1280px.
- **Celular:** gaveta do design system, com foco preso e Escape prontos —
  busca no topo, categorias em acordeão, institucional no fim.
- **Fio de pão:** 12px em `ink-soft`, rola na horizontal em vez de quebrar em
  duas linhas; o alvo de toque é a faixa inteira de 44px, e o recuo negativo
  devolve o alinhamento à régua da esquerda.
- **Abas:** filete dourado de 2px embaixo da ativa, num pseudo-elemento para
  não empurrar o texto ao aparecer. Nunca caixa cheia.

### Prateleira (componente de assinatura)
Título à esquerda e atalho "ver todos" no canto oposto, alinhados pelo pé. A
fileira sangra até a borda da tela no celular — o cartão da ponta cortado pela
beirada é o que diz "há mais coisa aqui" — e volta à régua do container a
partir de 1280px. Barra de rolagem escondida, `scroll-snap` no início do
cartão, setas redondas só onde há apontador (`hover: hover` e ≥1024px) e que
apagam em vez de sumir nas pontas.

### Botão flutuante do WhatsApp
Círculo de 56px no verde do canal, 16px da borda no celular e 24px a partir de
768px, com a sombra do sistema. Sobe 64px quando o rodapé entra na tela — sobe,
não some, porque quem rolou até o fim é justamente quem está decidindo
perguntar. Recolhe pela direita (`translateX(150%)`) enquanto a página desce,
porque no celular aquele canto é onde mora o preço do segundo cartão de cada
fileira.

### Esqueleto
A forma do conteúdo antes dele chegar, em areia com canto de 4px. O brilho que
atravessa é um pseudo-elemento deslizando com `transform`, e não um gradiente
animado em `background-position`: a home carrega mais de trezentos esqueletos
de uma vez, e `background-position` repinta na CPU a cada quadro.

## Do's and Don'ts

### Do:
- **Do** tirar toda cor, tipo, espaço, raio, sombra e duração de
  `frontend/src/styles/tokens.css`. Cor com transparência se escreve com
  `color-mix` sobre o token.
- **Do** usar `gold` só onde se clica ou se ganha, `gold-deep` quando o dourado
  precisa virar texto ou traço fino, e `on-gold` no que vai por cima do dourado.
- **Do** pintar bloco escuro com `slab` + `slab-ink`, e texto secundário sobre
  ele com `slab-muted`.
- **Do** começar todo conteúdo na mesma vertical, inclusive o primeiro cartão de
  uma prateleira que sangra — `max(var(--gutter), calc((100vw -
  var(--container-max)) / 2 + var(--gutter)))`, com o `scroll-padding-inline`
  igual.
- **Do** fixar a medida do cartão com `flex: 0 0 X` e `min-width: 0`.
- **Do** reservar a linha que pode faltar — preço riscado, parcela, nome de duas
  linhas — para que a fileira tenha uma altura só.
- **Do** pôr `position: relative` em todo trilho que rola na horizontal.
- **Do** separar por filete de 1px e por tom de fundo.
- **Do** escrever número de dinheiro com `.tabular`.
- **Do** manter o anel de foco dourado de 2px em tudo, trocando só a cor sobre
  fundo escuro ou sobre o dourado.

### Don't:
- **Don't** escrever cor nova num CSS Module — hexadecimal ou `rgb()` literal
  que não seja derivação declarada de um token.
- **Don't** usar `gold` como texto (2.4:1) nem `muted` sobre a laje (3.3:1).
- **Don't** inverter `on-gold` com o tema, nem pintar laje com `ink`.
- **Don't** pôr gradiente decorativo, sombra colorida ou segundo nível de
  elevação em superfície nenhuma.
- **Don't** pôr sombra, borda ou fundo próprio em cartão de produto.
- **Don't** deixar cartão esticar com `flex-grow` nem centralizar o trilho para
  fechar o vão de uma fileira curta — as duas coisas quebram a medida única ou
  a régua da esquerda.
- **Don't** alargar `container-max` além de 1280px: aquela margem é o corredor
  do botão flutuante.
- **Don't** pendurar uma linha curta em caixa alta sobre um título de seção para
  anunciá-lo.
- **Don't** escrever em Cormorant Garamond fora da assinatura "Maison Essence".
- **Don't** descer Readex Pro para corpo pequeno: abaixo de 18px ela e a Onest
  são a mesma fonte com nomes diferentes.
- **Don't** declarar uma família num token sem importar o peso dela em
  `main.tsx`: o token resolve calado para o fallback do sistema.
- **Don't** trocar o `@fontsource` por `<link>` do Google — a bancada de
  captura e a produção medem a mesma página de propósito.
- **Don't** usar pílula em botão.
- **Don't** cobrir o cartão inteiro com um alvo clicável absoluto — a foto leva
  ao produto, o botão põe na sacola.

## Residuais declarados

Decisões documentadas da build revisada, registradas como defeito conhecido e
**não** como regra do sistema. Nenhuma delas deve ser herdada por superfície
nova.

- **Brinde por valor de compra.** Mecânica real do negócio sem campo na API.
  Vive como constante declarada (`GIFT` em `store.constants.ts`), vazia por
  padrão e escondida enquanto vazia — o mesmo tratamento do CNPJ do rodapé.
- **Corredor do flutuante entre ~1300px e 1440px.** Nessa janela a margem
  encurta e o botão cobre até 56px da borda direita do conteúdo. Quem resolve é
  o recolhimento na rolagem, não a largura do container.
- **Cartão de faixa de preço em duas linhas.** "R$ 389,00 – R$ 479,00" com o
  "% OFF" embaixo ocupa duas linhas; nele o que alinha com os vizinhos é o pé do
  bloco, não o número. Alinhar o número exigiria uma terceira linha fixa em
  todos os cartões.
- **Vão no fim da prateleira curta.** Consequência aceita da medida única e da
  régua da esquerda. Aparece só quando a loja tem menos de cinco produtos em
  promoção.
