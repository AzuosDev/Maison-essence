# Atalhos da home

A fileira de circulos logo abaixo do banner: nome, foto e destino de cada um.
E a mesma lista que o painel edita em **Ajustes -> Atalhos da home** — este
script existe para montar a fileira inteira de uma vez, nao para substituir o
painel.

## O que mudou, e por que

Ate os atalhos existirem, aquela fileira era literalmente as categorias-raiz do
catalogo, na ordem de **Categorias**. Isso amarrava duas decisoes diferentes num
campo so: por "Mais vendidos" na primeira tela exigia inventar uma categoria
vazia, e destacar uma marca exigia transformar a marca em categoria e
reclassificar os produtos.

Agora a fileira e lista propria. A arvore de categorias voltou a ser so a
organizacao do catalogo, e continua mandando no menu.

**Sem nenhum atalho cadastrado a home volta a desenhar as categorias-raiz.** E
o estado de reserva, nao um defeito: nenhuma loja perde a primeira navegacao da
pagina por causa de uma lista que ninguem preencheu.

## Como usar

1. As fotos da fileira vivem em `fotos-categorias/`, na raiz do repositorio —
   e la que elas sao versionadas, e nao aqui. Aponte o script para a pasta:

   ```sh
   npm run shortcuts:upload -- --dir=../fotos-categorias --dry-run
   ```

   O `art/` deste diretorio existe para a foto solta que ainda nao foi
   versionada: sem `--dir`, e dele que o script le.

   O nome de cada arquivo casa com o campo `file` do atalho em `config.ts`,
   sem diferenciar maiuscula, acento nem extensao dupla — `MAIS VENDIDOS.jpg.jpeg`
   e o atalho "Mais vendidos".

2. O dry-run nao grava e nao sobe nada: ele le o cadastro, confere cada destino
   e imprime a fileira que ficaria gravada.

3. Suba:

   ```sh
   npm run shortcuts:upload -- --dir=../fotos-categorias
   ```

| Opcao                | O que faz                                              |
| -------------------- | ------------------------------------------------------ |
| `--dry-run`          | So diz o que faria.                                     |
| `--force`            | Reenvia foto que ja esta no Cloudinary.                 |
| `--dir=../fotos`     | Outra pasta de fotos.                                   |
| `--criar-categorias` | Cria, vazias, as categorias que um destino pede e nao existem. |

## A lista manda, e a pasta so da as fotos

Quem decide a fileira e `config.ts`: ordem, nome e destino de cada circulo.
Depois do primeiro envio a lista e editada no painel — este arquivo e so o
ponto de partida.

**Atalho sem arquivo correspondente continua entrando na fileira**, sem foto: o
circulo cai na inicial do nome, que e o estado vazio que a home ja desenha.
Nome e destino sao o que o atalho precisa; a foto e acabamento.

## A fileira vai inteira

As configuracoes passam a ter exatamente os atalhos de `config.ts`, nessa
ordem. O que estava gravado antes sai da home — e por isso o script imprime o
que vai tirar antes de gravar.

Rodar duas vezes nao duplica nada: o `_id` de cada atalho e preservado pelo
destino, que e o que ha de estavel entre uma gravacao e outra.

## O que ele confere antes de gravar

Todo destino e conferido contra o cadastro, e o que nao resolve vira aviso em
vez de um circulo que leva a uma pagina vazia:

- **categoria** que nao existe na arvore;
- **marca** que nenhum produto tem escrita no cadastro.

O aviso **nao impede a gravacao**, de proposito: a dona pode estar montando a
fileira antes de cadastrar os produtos. O que ela nao pode e descobrir isso
pela cliente que tocou no circulo.

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

A home **nao recorta** a arte num circulo. O disco colorido que a propria arte
traz e desenhado na medida exata do circulo — 104px no desktop — e o que a arte
puser fora do disco aparece por fora, solto sobre a pagina. E para isso que a
arte cresce 1/0,843 em `shortcut-circles.module.css`.

Logo, a arte precisa de duas coisas:

1. **Quadrada, com o disco centrado ocupando 84,3% do lado.** E a medida das
   artes que a loja usa; disco menor flutua dentro do circulo, disco maior
   estoura o contorno.
2. **Fundo transparente fora do disco.** Quem garante isso e o proprio script:
   cada arte passa por `art.ts`, que recorta o branco ligado as beiradas do
   arquivo e sobe a arte como PNG. Pelo painel, a dona precisa enviar um PNG
   ja recortado — fundo branco desenha um quadrado em volta do circulo,
   invisivel na loja clara e leitoso no tema escuro.

## O endereco da arte muda quando a arte muda

`maison-essence/shortcuts/feminino-3f9c21a8`: o sufixo e a impressao digital
da arte recortada. Existe porque a entrega do Cloudinary manda o navegador
guardar a foto por **30 dias** — com nome fixo, trocar a arte nao trocaria a
foto de quem ja esteve na loja, por mais que o CDN fosse limpo. Arte nova,
endereco novo, e a troca aparece no primeiro carregamento de todo mundo.

Rodar duas vezes com a mesma arte nao reenvia nada: mesma impressao digital,
mesmo endereco.

**A arte que sai de cena e removida da conta**, depois que a fileira nova esta
gravada e so se nenhum atalho a usar mais. Sem isso, cada troca de foto
deixaria para tras um arquivo que ninguem ve e ninguem apaga.

O painel mostra o circulo no tamanho real, com a sobra para fora, justamente
para que esse enquadramento se descubra ali e nao na loja.
