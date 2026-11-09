# Cartazes de colecao

As duas artes largas no meio da home, entre as prateleiras: nome, arte e
destino de cada uma. E a mesma lista que o painel edita — este script existe
para montar a faixa inteira de uma vez, nao para substituir o painel.

## O que mudou, e por que

Ate os cartazes existirem, aquela faixa era literalmente **as duas
categorias-raiz com mais produtos que tivessem foto**, deduzidas do catalogo.
Ninguem escolhia: o catalogo escolhia, e a faixa trocava sozinha quando ele
crescia. Por "Victoria's Secret" ali, que e marca, ou "Mais vendidos", que nao
e categoria nenhuma, era impossivel sem inventar uma categoria vazia e
reclassificar produto.

E a mesma amarra que os atalhos desfizeram na fileira de circulos, e a saida e
a mesma: lista propria.

**Sem nenhum cartaz cadastrado a home volta a deduzir as duas categorias.** E
o estado de reserva, nao um defeito: nenhuma loja perde a faixa por causa de
uma lista que ninguem preencheu.

## Por que nao sao os dois primeiros atalhos

Os destinos coincidem hoje — "Victoria's Secret" e "Mais vendidos" sao circulo
e cartaz —, e ainda assim as listas sao separadas. Amarra-las faria o quarto
circulo virar cartaz no dia em que a dona reordenasse a fileira, e tiraria dela
a escolha de destacar no meio da pagina algo que nao esta na primeira tela. Sao
duas decisoes, e duas decisoes moram em dois campos.

## Como usar

1. As artes vivem em `fotos-colecao/`, na raiz do repositorio — e la que elas
   sao versionadas, e nao aqui. Aponte o script para a pasta:

   ```sh
   npm run posters:upload -- --dir=../fotos-colecao --dry-run
   ```

   O `art/` deste diretorio existe para a arte solta que ainda nao foi
   versionada: sem `--dir`, e dele que o script le.

   O nome de cada arquivo casa com o campo `file` do cartaz em `config.ts`,
   sem diferenciar maiuscula, acento nem extensao dupla — `MAIS VENDIDOS.jpg`
   e o cartaz "Mais vendidos".

2. O dry-run nao grava e nao sobe nada: ele le o cadastro, confere cada
   destino e cada enquadramento, e imprime a faixa que ficaria gravada.

3. Suba:

   ```sh
   npm run posters:upload -- --dir=../fotos-colecao
   ```

| Opcao              | O que faz                               |
| ------------------ | --------------------------------------- |
| `--dry-run`        | So diz o que faria.                     |
| `--force`          | Reenvia arte que ja esta no Cloudinary.  |
| `--dir=../fotos`   | Outra pasta de artes.                    |

## A lista manda, e a pasta so da as artes

Quem decide a faixa e `config.ts`: ordem, nome e destino de cada cartaz.

**Cartaz sem arquivo correspondente nao entra na faixa**, ao contrario do
atalho sem foto. O circulo sem foto cai na inicial do nome e continua um
atalho; o cartaz sem arte e um retangulo cinza de meia tela no meio da vitrine,
e a home se recusa a desenha-lo. E porque a faixa sao duas colunas, um cartaz
sozinho tambem nao serve: com menos de dois, o script nao grava nada e diz por
que.

## O enquadramento e conferido, e nao corrigido

**1920 x 1080, exatamente 16:9.** A moldura da home tem `aspect-ratio: 16 / 9`
fixo e `object-fit: cover`, entao arte de outra proporcao e cortada pelo
centro; e a entrega do Cloudinary vai ate `w_1920`, que e o que um monitor
retina grande pede — abaixo de 1200px de largura a arte chega mole nessas
telas, porque `c_limit` reduz e nunca amplia.

As duas coisas viram aviso escrito com a medida encontrada. Aviso, e nao
recorte automatico: cortar uma arte pelo centro calado e exatamente o que
ninguem quer que aconteca.

O pe do cartaz leva um veu escuro e, sobre ele, o nome e o "VER A COLECAO",
alinhados a esquerda — os 40% de baixo e o canto inferior esquerdo sao area de
texto, e nao de produto.

## A arte sobe como ela e

Sem recorte de fundo, ao contrario do `shortcuts:upload`: o cartaz e uma
paisagem cheia, e o fundo dela e parte da arte. O arquivo vai para a conta no
formato em que chegou.

## A faixa vai inteira

As configuracoes passam a ter exatamente os cartazes de `config.ts`, nessa
ordem. O que estava gravado antes sai da home — e por isso o script imprime o
que vai tirar antes de gravar.

Rodar duas vezes nao duplica nada: o `_id` de cada cartaz e preservado pelo
destino, que e o que ha de estavel entre uma gravacao e outra.

## O que ele confere antes de gravar

Todo destino e conferido contra o cadastro, e o que nao resolve vira aviso em
vez de um cartaz que leva a uma pagina vazia:

- **categoria** que nao existe na arvore;
- **marca** que nenhum produto tem escrita no cadastro.

O aviso **nao impede a gravacao**, de proposito: a dona pode estar montando a
faixa antes de cadastrar os produtos. O que ela nao pode e descobrir isso pela
cliente que tocou no cartaz.

## Contra qual banco isto roda

O `ConfigModule` carrega `['.env.local', '.env']`, nessa ordem. **Confira para
onde esses arquivos apontam antes de rodar sem `--dry-run`**: nesta instalacao
`.env` aponta para o banco da loja de verdade, e nao para um banco de
desenvolvimento separado.

Para rodar contra outro banco, aponte as variaveis explicitamente na chamada em
vez de renomear arquivo de ambiente — renomear deixa a maquina apontada para la
depois que o comando acabou, e o proximo seed roda no mesmo lugar sem ninguem
ter pedido.

## O endereco da arte muda quando a arte muda

`maison-essence/posters/mais-vendidos-3f9c21a8`: o sufixo e a impressao digital
do arquivo. Existe porque a entrega do Cloudinary manda o navegador guardar a
foto por **30 dias** — com nome fixo, trocar a arte nao trocaria a foto de quem
ja esteve na loja, por mais que o CDN fosse limpo. Arte nova, endereco novo, e
a troca aparece no primeiro carregamento de todo mundo.

Rodar duas vezes com a mesma arte nao reenvia nada: mesma impressao digital,
mesmo endereco.

**A arte que sai de cena e removida da conta**, depois que a faixa nova esta
gravada e so se nenhum cartaz a usar mais. Sem isso, cada troca deixaria para
tras um arquivo que ninguem ve e ninguem apaga.
