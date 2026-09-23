# Banners da home

Arte que ja chega pronta — logo, frase e chamada desenhados dentro do arquivo
— e registrada por aqui, e nao uma a uma pelo painel.

## Como usar

1. Ponha os arquivos em `art/`, numerados na ordem em que devem girar no
   carrossel: `01-marca.png`, `02-campanha.png`. O nome vira o identificador
   no Cloudinary, entao renomear e subir de novo cria outro banner em vez de
   substituir o que estava la.

2. Confira o que vai acontecer:

   ```sh
   npm run banners:upload -- --dry-run
   ```

3. Suba:

   ```sh
   npm run banners:upload
   ```

A lista de banners da home e **trocada inteira** pelo que esta em `art/`. O que
estava registrado antes sai da home; a arte continua no Cloudinary, entao
voltar atras e por o arquivo de volta na pasta e rodar de novo. O script avisa
no log o que vai sair, antes de gravar.

Ajuste fino de um banner — link, periodo de exibicao, imagem propria para o
celular — e no painel. Este script serve para trocar a campanha inteira.

Arte que ja esta no Cloudinary nao e reenviada; `--force` reenvia.

## O que a loja faz com essas artes

Banner sem `title`, `subtitle` nem `buttonLabel` cadastrados e tratado como
arte inteira: a vitrine larga a grade de foto + bloco de texto, tira o veu e
desenha o arquivo de ponta a ponta. E por isso que o script grava os tres
campos vazios — escrever um titulo faria a loja sobrepor texto ao texto que ja
esta dentro da imagem.

## Duas coisas para saber antes

**A medida da arte e 1920 x 562,283.** E a faixa que o banner desenha, e a
regra em `frontend/src/pages/home/home-hero.module.css` esta escrita com esses
dois numeros — nao reduzida a uma proporcao — para conferir contra o arquivo do
design. Arte fora dessa medida entra cortada pelo centro, e nao encolhida com
tarja preta em volta: `object-fit: cover`. Uma arte 16/9 (1920x1080) perde 48%
da altura, o que costuma comer o rodape da composicao.

**O celular precisa de arte propria.** O script grava o mesmo arquivo em
`imageMobile` porque e o que ha. Uma faixa de 1920px de largura num telefone de
390px fica com o texto em poucos pixels de altura. Enquanto nao houver uma
versao em retrato, o banner do celular e ilegivel — e isso se resolve no
painel, trocando a imagem mobile de cada banner.
