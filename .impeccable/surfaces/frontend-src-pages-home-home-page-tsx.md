---
version: 1
slug: "frontend-src-pages-home-home-page-tsx"
primary_target: "frontend/src/pages/home/home-page.tsx"
related_targets: ["frontend/src/components/store","frontend/src/pages/catalog","frontend/src/pages/product","frontend/src/styles/tokens.css"]
---

## Scope

A vitrine inteira da Maison Essence: home, catálogo (vitrine, categoria, busca), página de produto e a moldura da loja — barra de avisos, cabeçalho, busca, menu, sacola, rodapé, WhatsApp. Painel administrativo fora de escopo.

Visitor mode: **Persuade**.

## Audience and job

Dois públicos de peso igual: quem vem do Instagram/WhatsApp quase decidido (celular, quer preço, parcela e pronta entrega) e quem chega de busca ou anúncio sem conhecer a loja (precisa confiar antes de considerar). Ação: adicionar à sacola e fechar o pedido no site.

Prova disponível: preço com comparativo, % de desconto, parcelamento calculado, desconto progressivo por quantidade, frete grátis a partir de valor, pronta entrega, retirada em Juazeiro do Norte, WhatsApp da dona. Nada além disso pode ser afirmado: não há avaliação, depoimento, número de clientes nem campo de brinde na API.

## Direction contract

THESIS: A loja popular brasileira de perfume importado — o arranjo que a referência (importssjs.com.br) usa e que a cliente já sabe percorrer de olhos fechados — executada com um acabamento que a referência não tem: grade sem buraco, cartão de altura única, selo legível, foto sobre branco, nenhuma região morta. Recusa o arranjo que a loja usa hoje: fundo quase-preto, serifada dourada fina, muito ar e quase nenhuma informação comercial. Escolha explícita da dona: a porta de saída permanente da rodada de direção, convenção assumida como compromisso.

OWN-WORLD: Branco dominante como chão da loja, areia clara (#F7F5F1) só para separar seções, tinta #121212 nas lajes (avisos, menu, rodapé). O dourado da marca (#C39540) é a única cor de ação — botão Comprar preenchido, selo de desconto, filete sob o título ativo; `--gold-deep` onde o dourado vira texto. Verde e vermelho em dose de selo, nunca de superfície. Onest em tudo que é interface, com numeral tabular no preço; Cormorant só na assinatura da marca. Zero gradiente, zero sombra colorida: separação por filete de 1px e por tom de fundo.

STORY: A visitante entende em um olhar que é uma loja de perfume importado que vende hoje, com desconto visível e parcela, entrega combinada e atendimento no WhatsApp; encontra o que quer pela busca larga, pelas categorias em círculo ou pelas três fileiras; e chega à sacola em dois cliques a partir de qualquer card.

FIRST VIEWPORT: Faixa preta de avisos rolando no topo. Cabeçalho branco: menu e monograma à esquerda, busca de ponta a ponta com botão dourado no centro, conta e sacola com valor à direita. Barra preta de navegação full-width abaixo, com CATEGORIAS abrindo painel. Carrossel de banner da dona, proporção fixa, pontos dourados. Fileira de categorias em círculo logo abaixo, rolável no celular. A ação primária da dobra é a busca; a secundária, a categoria.

FORM: Canon — a porta de saída permanente da rodada de direção, escolhida pela dona em palavras diretas ("quero o mesmo template do importssjs... fundo branco majoritariamente"). Fora da lista de sete candidatos; a lista sorteada (Folha de Cordel, índice 7) foi apresentada e recusada. Padrão de acabamento definido pela dona: a própria Importss JS, melhor feita. Seed key 2924117e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Composition da home (ordem travada)

1. Barra de avisos · 2. Cabeçalho com busca larga · 3. Barra preta de navegação · 4. Carrossel de banner · 5. Categorias em círculo · 6. **Mais vendidos** · 7. Marcas da casa (tipográfico, sem logo de terceiro) · 8. Dois cartazes de coleção (categorias reais) · 9. **Aproveite nossas promoções** · 10. Faixa de benefícios (4) · 11. **Compre também** · 12. Perfume em destaque (bloco grande, descrição real) · 13. Instagram · 14. Newsletter · 15. Rodapé · WhatsApp flutuante.

Três fileiras de produto, decisão da dona. As prateleiras de marca saem da home e viram filtro no catálogo.

## Unresolved

- **Brinde por valor de compra** é mecânica real do negócio e não existe na API. Entra como constante declarada, vazia por padrão, escondida enquanto vazia — o mesmo tratamento do CNPJ do rodapé. Precisa de campo em `StoreSettings` para funcionar de verdade.
- Não há logo de marca de terceiro no repositório; a faixa de marcas é tipográfica por isso, não por estilo.
- **Corredor do flutuante do WhatsApp em janela estreita.** Com `--container-max` em 1280px, em 1440 a margem de 80px aloja o botão inteiro e nada passa por baixo dele em repouso. Entre ~1300px e 1440px a margem volta a encurtar e o botão cobre até 56px da borda direita do conteúdo. Fechar isso exigiria ou coluna mais estreita em toda largura, ou gutter assimétrico, ou nenhum botão fixo — os três custam mais do que o defeito. Para essa faixa, quem resolve é o recolhimento na rolagem (`whatsapp-button.tsx`).
- **Cartão de faixa de preço com duas linhas de preço.** `.prices` reserva a linha do riscado e ancora o bloco pelo pé, então todo cartão de preço único alinha o número grande com os vizinhos. O cartão de faixa ("R$ 389,00 – R$ 479,00" com "até 15% OFF" embaixo) ocupa duas linhas por largura do próprio texto: o que alinha nele é o pé do bloco, não o número. Alinhar o número exigiria pôr o "% OFF" numa terceira linha fixa em todos os cartões, somando ~14px de vão a cada um e separando o desconto do preço que ele desconta.
- **Vão no fim da prateleira curta.** Três coisas disputam a mesma linha e só duas cabem: card de medida única em toda a página, fileira na régua da esquerda, e nenhum vão no fim quando a prateleira e curta. As duas primeiras ganham, e o vão fica. Ele aparece pouco — `fetchSaleShelf` pede dezesseis e mostra oito, então só uma loja com menos de cinco produtos em promoção vê a fileira curta. Centralizar o trilho foi tentado e desfeito: devolvia a medida do card, mas punha a fileira do meio 120px para dentro, única fora da régua em toda a página.
