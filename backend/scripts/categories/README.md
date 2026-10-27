# Fotos das categorias

A foto que aparece no circulo de categoria da home. E o mesmo campo que o
painel preenche em **Editar categoria -> Enviar foto** — este script existe
para fazer as sete de uma vez, nao para substituir o painel.

## Como usar

1. Ponha os arquivos em `art/`, **cada um com o nome do slug da categoria**:
   `perfumes.jpg`, `body-splash.jpg`, `miniaturas-25ml.jpg`. O nome e o que
   casa o arquivo com a categoria.

2. Confira o que vai acontecer:

   ```sh
   npm run categories:upload -- --dry-run
   ```

   O dry-run nao grava nada e nao sobe nada: ele le o cadastro e imprime, para
   cada arquivo, a categoria encontrada e a foto que ela tem hoje.

3. Suba:

   ```sh
   npm run categories:upload
   ```

Foto que ja esta no Cloudinary nao e reenviada; `--force` reenvia.

## O que ele nao faz

**Nao apaga foto de categoria que ficou de fora da pasta.** Diferente do
`banners:upload` — que troca a campanha inteira em bloco —, a arvore de
categorias e permanente: rodar com um arquivo so troca aquela foto e deixa as
outras como estao. Tirar a foto de uma categoria e no painel, no botao
"Remover".

**Nao cria categoria.** Arquivo cujo slug nao existe no cadastro faz o script
avisar e seguir. Criar categoria e decisao de quem opera a loja, nao efeito
colateral de ter posto um arquivo numa pasta.

## Contra qual banco isto roda

O `ConfigModule` carrega `['.env.local', '.env']`, nessa ordem — ou seja, **o
padrao e o banco de desenvolvimento**. A loja de verdade esta no
`.env.production.local`, que nao entra nessa lista de proposito: gravar na
producao tem de ser um ato deliberado, e nao o que acontece por distracao.

Para rodar contra a producao, aponte as variaveis explicitamente na chamada em
vez de renomear arquivo de ambiente — renomear deixa a maquina apontada para a
producao depois que o comando acabou, e o proximo seed roda la sem ninguem ter
pedido.

## O enquadramento

A vitrine recorta num circulo de 88px (`category-circles.module.css`). Foto
quadrada, assunto centralizado e fundo claro e o que sobrevive a esse corte;
frasco alto e estreito perde o gargalo.

As fotos nao precisam ser grandes: o preset `thumb` entrega 400px.
