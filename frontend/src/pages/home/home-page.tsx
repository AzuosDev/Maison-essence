import { Fragment } from 'react';
import { ROUTES } from '@/app/routes';
import { ProductShelf, shelfWillRender, type ShelfContent } from '@/components/store';
import { useLatest, useShelf } from '@/features/catalog';
import { BrandStatement } from './brand-statement';
import { CategoryStrip } from './category-strip';
import { HomeHero } from './home-hero';

/**
 * Depois de quantas prateleiras entram as colecoes e a assinatura da marca.
 *
 * Duas: quem chega pelo banner veio ver perfume, e as colecoes respondem "o
 * que mais voce tem" — que e a pergunta de quem ja passou os olhos pela
 * vitrine e nao se decidiu. Uma prateleira so nao e vitrine suficiente para
 * justificar a pergunta.
 */
const SECTIONS_BEFORE_COLLECTIONS = 2;

interface Shelf {
  key: string;
  title: string;
  description: string;
  to: string;
  linkLabel: string;
  content: ShelfContent;
}

/**
 * A vitrine.
 *
 * ## A ordem das secoes
 *
 * Banner, duas prateleiras, as colecoes, a assinatura da marca e o resto das
 * prateleiras. **Pronta entrega vem antes de mais vendidos** porque e o que
 * de fato vende aqui: quem compra perfume numa loja pequena do interior quer
 * saber o que da para levar hoje, e nao o que a loja mais vendeu no
 * trimestre. Destaques vem antes das duas por ser a prateleira que a dona
 * controla a mao — e a vitrine da frente.
 *
 * **Novidades e a unica que nao depende de ninguem, e por isso existe.** As
 * outras tres respondem a marcacao no painel — destaque, pronta entrega — ou
 * ao historico de pedidos, e as tres saem vazias numa loja que acabou de
 * subir o catalogo. Foi o que aconteceu: catalogo inteiro cadastrado, nenhum
 * produto marcado, nenhum pedido, e a home abria no banner e ia direto para
 * as colecoes. Novidades sai do proprio catalogo ordenado por data, e tem
 * produto no minuto em que o catalogo tem.
 *
 * Ela fica em terceiro, e nao em primeiro como na referencia, porque a ordem
 * acima nao e sobre quantidade de conteudo: e sobre o que responde a duvida
 * de quem compra aqui. Numa loja que so vende o que tem em maos, "chegou
 * agora" interessa menos que "da para levar hoje". Em terceiro ela continua
 * fazendo o trabalho de rede de seguranca: com as duas de cima vazias, e ela
 * que abre a vitrine.
 *
 * A assinatura da marca fica entre as colecoes e a ultima prateleira, e nao
 * no fim da pagina: ela e preta, o rodape tambem, e uma encostada no outro
 * viram um bloco escuro so com dois textos dentro.
 *
 * ## Por que as posicoes se resolvem em tempo de execucao
 *
 * `ProductShelf` some quando nao ha produto — prateleira vazia nao vira secao
 * com um titulo e o nada embaixo. So que isso muda a pagina: numa loja sem
 * nenhum destaque marcado, a home montada a mao desenhava o banner e, logo
 * embaixo, as colecoes. A faixa que deveria ser a terceira secao virava a
 * primeira, e o cliente batia no banner e numa tela de navegacao sem ter
 * visto um perfume.
 *
 * Por isso a lista e filtrada antes de desenhar: as posicoes valem sobre as
 * prateleiras que de fato aparecem, e nao sobre as que foram escritas aqui.
 * Quem encosta no banner e a primeira que sobrou, e as colecoes entram depois
 * da segunda.
 *
 * ## Por que nao ha uma consulta so
 *
 * Cada prateleira chama a sua rota. Poderiam ser uma chamada unica que
 * devolvesse tudo, e seria uma requisicao em vez de quatro — mas as quatro
 * sao independentes, saem em paralelo, tem cache de borda proprio e falham
 * separadas. Com a chamada unica, um erro em "mais vendidos" apagaria os
 * destaques junto.
 *
 * ## Layout que nao salta
 *
 * Toda secao ocupa a altura final desde o primeiro quadro: o hero pela
 * proporcao fixa da foto, as prateleiras pelos esqueletos — que sao o proprio
 * card com as linhas em branco — e a faixa de categorias pelo card de mesma
 * proporcao. O unico dado que chega depois e o parcelamento, e a linha dele
 * ja vem com altura reservada no card.
 */
export default function HomePage() {
  const featured = useShelf('featured');
  const latest = useLatest();
  const readyToShip = useShelf('ready-to-ship');
  const bestSellers = useShelf('best-sellers');

  const shelves: Shelf[] = [
    {
      key: 'featured',
      title: 'Destaques',
      description: 'A selecao da casa, trocada com frequencia.',
      to: ROUTES.products,
      linkLabel: 'Ver todos os produtos',
      content: contentOf(featured),
    },
    {
      key: 'ready-to-ship',
      title: 'Pronta entrega',
      description: 'Em maos agora: retire em Juazeiro do Norte ou receba primeiro.',
      to: ROUTES.readyToShip,
      linkLabel: 'Ver tudo em pronta entrega',
      content: contentOf(readyToShip),
    },
    {
      key: 'latest',
      title: 'Novidades',
      description: 'Os ultimos perfumes que entraram no catalogo.',
      to: `${ROUTES.products}?ordem=novidades`,
      linkLabel: 'Ver por data de chegada',
      content: contentOf(latest),
    },
    {
      key: 'best-sellers',
      title: 'Mais vendidos',
      description: 'O que mais saiu nas ultimas semanas.',
      to: ROUTES.products,
      linkLabel: 'Ver todos',
      content: contentOf(bestSellers),
    },
  ];

  const visible = shelves.filter((shelf) => shelfWillRender(shelf.content));

  /*
   * Depois de qual das prateleiras visiveis entram as colecoes.
   *
   * O minimo, e nao a constante direto: numa loja com uma prateleira so,
   * esperar pela segunda jogaria as colecoes para o fim da pagina. `-1` no
   * fim porque o que se compara e o indice.
   *
   * Com nenhuma prateleira visivel o valor e -1 e nao casa com indice nenhum
   * — que e o certo, porque ai as colecoes ja saem antes do laco.
   */
  const collectionsAfter = Math.min(SECTIONS_BEFORE_COLLECTIONS, visible.length) - 1;

  return (
    <>
      <HomeHero />

      {/* Catalogo vazio de verdade — nem novidades ha. As colecoes viram a
          primeira secao depois do banner, e entao sao elas que encostam
          nele. */}
      {visible.length === 0 ? <Collections flush /> : null}

      {visible.map((shelf, index) => (
        <Fragment key={shelf.key}>
          <ProductShelf
            title={shelf.title}
            description={shelf.description}
            products={shelf.content.products}
            isLoading={shelf.content.isLoading}
            isError={shelf.content.isError}
            to={shelf.to}
            linkLabel={shelf.linkLabel}
            // A primeira encosta no banner: o respiro de cima separa duas
            // secoes de mesmo tom, e contra a foto escura ele so empurra o
            // produto para fora da primeira tela.
            flush={index === 0}
            // O fundo em areia alterna por posicao, e nao por prateleira: e o
            // que garante que duas fileiras seguidas nunca saiam no mesmo
            // tom, mesmo quando uma das quatro nao tem produto e some.
            //
            // Par e impar, e nao "a segunda": com quatro prateleiras, tingir
            // so a segunda deixava novidades e mais vendidos em creme uma
            // encostada na outra, e as duas liam como uma fileira de dez.
            tinted={index % 2 === 1}
          />

          {index === collectionsAfter ? <Collections /> : null}
        </Fragment>
      ))}

      {/*
        Os selos de confianca e a newsletter nao se repetem aqui.

        O rodape ja traz os dois, em toda pagina da loja. Com as faixas claras
        da home logo acima dele, o cliente via o mesmo campo de e-mail duas
        vezes em 200px de rolagem, e os tres selos duas vezes em 400px — o que
        nao reforca a mensagem, so faz a pagina parecer montada duas vezes.
      */}
    </>
  );
}

/**
 * O resultado da consulta reduzido ao que decide se a prateleira aparece.
 *
 * Serve as quatro: `useLatest` devolve a mesma forma que `useShelf`, que e o
 * que permite a home tratar novidades como mais uma prateleira, sem saber que
 * ela vem de outro endereco.
 */
function contentOf(query: ReturnType<typeof useShelf>): ShelfContent {
  return { products: query.data, isLoading: query.isLoading, isError: query.isError };
}

/**
 * As colecoes e a assinatura da marca, que andam juntas.
 *
 * Sao duas secoes, nao uma, mas nunca aparecem separadas: a assinatura existe
 * para responder "quem e essa loja de quem eu nunca ouvi falar?", e o lugar
 * dela e depois de o cliente ter visto o que a loja vende e como ela se
 * organiza. Mante-las num componente so e o que impede que um remanejamento
 * futuro mande o preto da assinatura encostar no preto do rodape.
 */
function Collections({ flush = false }: { flush?: boolean }) {
  return (
    <>
      <CategoryStrip flush={flush} />
      <BrandStatement />
    </>
  );
}
