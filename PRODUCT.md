# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dois públicos de peso parecido, confirmados pela dona:

1. **Quem vem do Instagram ou do WhatsApp.** Já viu o perfume num story, chega
   quase decidido e quer fechar rápido: preço, parcela, se tem pronta entrega e
   como pagar. Costuma chegar pelo celular.
2. **Quem chega de busca ou anúncio, sem conhecer a loja.** Precisa entender o
   que é a Maison Essence e decidir se confia antes de considerar comprar.

A vitrine serve os dois caminhos na mesma página: fechar a venda de quem já
decidiu, sem perder quem ainda está decidindo.

## Product Purpose

Loja da Maison Essence: perfumes importados, linhas de corpo e velas
aromáticas. Base em Juazeiro do Norte, no Cariri cearense, com retirada
combinada na cidade e envio para todo o Brasil. O site existe para vender
direto — não é catálogo nem vitrine institucional — e é operado inteiramente
pela dona, pelo painel.

Sucesso é o pedido fechado no site, não o contato gerado.

## Positioning

O que a dona confirmou como a diferença da casa, em ordem de peso:

- **Preço, parcelamento e promoção**, no mesmo terreno das concorrentes
  populares do segmento: desconto visível, preço riscado, parcela no cartão,
  desconto progressivo por quantidade, frete grátis a partir de um valor.
- **Brinde a partir de um valor de compra.** Mecânica real do negócio hoje.
  Ver *Capabilities and Constraints*: a API ainda não tem campo para ela.
- **Atendimento um a um no WhatsApp**, com a dona, antes e depois da compra.
- **Curadoria curta e original**, escolhida peça a peça, conferida antes de
  sair — e não um catálogo gigante de milhares de itens.

## Operating Context

A dona opera tudo pelo painel administrativo: banners agendados da home,
marcação de destaque e de pronta entrega, árvore de categorias, produtos e
variantes, frete por cidade, mínimo de frete grátis, páginas institucionais e
textos da barra de avisos. Nenhuma dessas decisões passa por deploy.

As fotos vivem no Cloudinary e são montadas pelo `publicId` nos presets
`thumb`, `card` e `detail`.

A venda frequentemente continua no WhatsApp — combinação de retirada, dúvida
sobre fixação, parcelamento — e o botão flutuante é parte do fluxo real, não
enfeite.

## Capabilities and Constraints

Mecânicas comerciais que **existem hoje** na API e podem ser desenhadas:

- preço com `compareAtPriceCents` e `discountPercent` (preço riscado e % OFF);
- desconto progressivo por quantidade (`quantityDiscount`: "leve 3 e ganhe 12%"),
  com o primeiro degrau no card e a escada inteira na página do produto;
- parcelamento calculado pelo backend;
- frete grátis acima de um valor, global ou por cidade, com o quanto falta;
- pronta entrega e retirada em Juazeiro do Norte;
- variantes com estoque, disponibilidade e sob encomenda;
- busca com sugestão, categorias em árvore, banners agendados.

O que **não existe** e não pode ser simulado como se funcionasse:

- **Brinde por valor de compra.** Não há campo em `StoreSettings` nem regra no
  carrinho. A vitrine pode anunciar a régua, mas o valor e o texto precisam
  nascer de um lugar declarado — e, enquanto a API não tiver o campo, de uma
  constante revisada, vazia por padrão, do mesmo jeito que o CNPJ do rodapé.
- **Inscrição em newsletter.** Não há rota; o formulário recusa com uma
  mensagem honesta que manda para o WhatsApp.
- **CNPJ e razão social.** Não vêm de `GET /settings`; o rodapé esconde a linha
  enquanto a constante estiver vazia.
- **Avaliações, selos de prova social, contagem de clientes.** Não há dado.
  Nada disso pode ser inventado na página.

Restrições técnicas que valem para a vitrine: dinheiro sempre em centavos; o
total é do servidor (`POST /cart/quote`), o carrinho é do navegador; uma
chamada por dado, distribuída por contexto; um boundary de erro por rota; site
estático na Vercel, consumindo a API do mesmo repositório.

## Brand Commitments

- **A logo e o dourado dela são intocáveis** — decisão explícita da dona. O
  monograma e o logotipo em `frontend/public/brand/` ficam, e o dourado da
  marca sai deles.
- O nome **Maison Essence**.
- As promessas já escritas e verdadeiras: pronta entrega, retirada combinada em
  Juazeiro do Norte, frete fixo para o Cariri, produto original conferido antes
  de sair.

Fora isso, a dona liberou tudo: tipografia, paleta além do dourado, estrutura
da página e das telas.

**Compromisso declarado em 23/10/2026: a loja segue a convenção da categoria.**
A dona viu a rodada de direção visual e escolheu, em palavras diretas, o
arranjo da concorrente `importssjs.com.br` com fundo branco dominante e três
fileiras de produto. O padrão de acabamento que ela definiu é "a própria
Importss JS, melhor feita". Isso é preferência permanente, não decisão de uma
tela: trabalho visual futuro executa essa convenção com rigor, sem ironia e
sem contrabandear um mundo visual próprio por cima dela.

## Evidence on Hand

- Logo e monograma reais em `frontend/public/brand/` (logo.png, monogram.png,
  monogram.webp).
- Catálogo, categorias, banners e textos institucionais vêm da API em produção;
  no desenvolvimento, da bancada `frontend/.preview` com dados fabricados e
  fotos da nuvem pública de demonstração do Cloudinary — **as fotos de produto
  do ambiente de desenvolvimento não são da loja** e não servem de referência
  para julgar a vitrine.
- Referência de direção indicada pela dona: `https://importssjs.com.br/` —
  concorrente direta do segmento, usada como evidência do motor comercial
  esperado, não como modelo visual a copiar.
- Não há fotografia própria de produto, depoimento, avaliação ou número de
  vendas disponível no repositório. Nada disso pode ser fabricado na página.

## Product Principles

1. **A venda acontece na vitrine, não no contato.** Preço, condição e
   disponibilidade aparecem onde a decisão é tomada, não uma tela adiante.
2. **Duas portas, uma página.** Quem já decidiu precisa de um caminho curto
   até a sacola; quem não conhece precisa de motivo para confiar. Nenhum dos
   dois pode custar a clareza do outro.
3. **Promessa só quando é verdade.** Mecânica sem backend não vira enfeite de
   tela: ou nasce de um lugar declarado, ou não aparece.
4. **A dona é a editora da loja.** O que ela controla pelo painel — banner,
   destaque, pronta entrega, categoria — é o que manda na página; o desenho
   precisa continuar bonito com o que ela publicar, inclusive vazio.
5. **O celular é o caso principal.** É de onde vem o público do Instagram.

## Accessibility & Inclusion

Mantém o patamar já construído e testado: foco visível sempre (anel dourado de
2px, nunca removido), diálogo e gaveta com foco preso e Escape, navegação por
setas em abas e sanfona, contraste mínimo de 4.5:1 para texto normal e 3:1 para
texto grande e elementos gráficos, com a tabela de uso de cada cor escrita ao
lado dos tokens.
