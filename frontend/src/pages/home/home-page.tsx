import { Fragment } from 'react';
import { ROUTES } from '@/app/routes';
import { ProductShelf, TrustBadges, shelfWillRender, type ShelfContent } from '@/components/store';
import { Container } from '@/components/ui';
import { useLatest, useSaleShelf, useShelf, type PublicProduct } from '@/features/catalog';
import { BrandRow } from './brand-row';
import { CategoryCircles } from './category-circles';
import { CollectionPosters } from './collection-posters';
import { FeaturedPerfume } from './featured-perfume';
import { HomeBanner } from './home-banner';
import { HomeHero } from './home-hero';
import { InstagramInvite } from './instagram-invite';

/**
 * A vitrine.
 *
 * ## A ordem das seções
 *
 * Banner, categorias em círculo, fileira, marcas, cartazes de coleção,
 * fileira, selos de confiança, fileira, banner do meio, Instagram, o perfume
 * da vez.
 *
 * E o arranjo que a dona escolheu, e ele não e arbitrário: e a ordem que
 * quase toda loja brasileira de perfume importado usa, e portanto a ordem
 * que a cliente dela já sabe percorrer sem aprender nada. Entre duas
 * fileiras de produto sempre entra uma seção de outra natureza — marcas,
 * cartazes, selos —, porque três fileiras seguidas viram uma só, longa, e o
 * olho para de distinguir onde uma acaba.
 *
 * A ordem foi conferida contra a referência em 27/10/2026, seção por seção,
 * pela posição de cada bloco no documento dela. Duas trocas sairam daquela
 * conferência: os cartazes subiram para junto das marcas, entre a primeira e
 * a segunda fileira, e os selos de confiança desceram para depois da segunda
 * — antes eles fechavam a última, onde repetiam de perto a faixa do rodapé.
 * O Instagram passou a vir antes do perfume da vez pelo mesmo motivo.
 *
 * ## Três fileiras, e quais
 *
 * Três, por decisão da dona. Quais três e o que sobra de uma lista de quatro
 * candidatas, em ordem de prioridade, depois de tirar as que não tem produto
 * — ver `slots`.
 *
 * O arranjo anterior tinha seis fileiras, três delas de marca. Marca agora e
 * filtro: o nome leva para a vitrine filtrada, e a faixa de marcas no meio
 * da página faz esse trabalho sem gastar uma fileira inteira por casa.
 *
 * ## Onde ficava a quinta candidata
 *
 * Havia uma quinta, "A seleção da casa", que mostrava os produtos marcados
 * como destaque. Ela saiu em 29/10/2026, por decisão da dona: a vaga dela
 * passou a ser a faixa de banner do meio (`HomeBanner`), que a dona compoe no
 * painel. Destaque não ficou sem uso na home — e ele que escolhe o produto de
 * "O perfume da vez", lá embaixo.
 *
 * ## Por que as prateleiras se resolvem em tempo de execução
 *
 * `ProductShelf` some quando não há produto — prateleira vazia não vira seção
 * com um título e o nada embaixo. Só que isso muda a página: numa loja sem
 * nenhum destaque marcado, a home montada a mão desenhava o banner e, logo
 * embaixo, uma faixa de navegação. A lista e filtrada antes de desenhar, e as
 * seções intercaladas entram entre as prateleiras que de fato apareceram.
 *
 * ## Por que não há uma consulta só
 *
 * Cada prateleira chama a sua rota. Poderiam ser uma chamada única que
 * devolvesse tudo, e seria uma requisição em vez de cinco — mas elas são
 * independentes, saem em paralelo, tem cache de borda próprio e falham
 * separadas. Com a chamada única, um erro em "mais vendidos" apagaria as
 * promoções junto.
 *
 * ## Layout que não salta
 *
 * Toda seção ocupa a altura final desde o primeiro quadro: o hero pela
 * proporção fixa da foto, as prateleiras pelos esqueletos — que são o próprio
 * card com as linhas em branco — e a fileira de categorias pelos círculos de
 * medida fixa. O único dado que chega depois e o parcelamento, e a linha dele
 * já vem com altura reservada no card.
 */

/** Quantas fileiras de produto a home mostra. Decisão da dona. */
const MAX_SHELVES = 3;

interface Shelf {
  key: string;
  title: string;
  description: string;
  to: string;
  linkLabel: string;
  content: ShelfContent;
}

export default function HomePage() {
  const bestSellers = useShelf('best-sellers');
  const sale = useSaleShelf();
  const readyToShip = useShelf('ready-to-ship');
  const latest = useLatest();

  /**
   * As quatro candidatas, em ordem de prioridade.
   *
   * As três primeiras são a vitrine que a dona quer, e são as mesmas três da
   * referência: o que mais vende, o que esta em promoção, o que acabou de
   * chegar. A última e rede de segurança para a loja que ainda não tem o que
   * mostrar nas três de cima.
   *
   * "Compre também" e a terceira, e não "Pronta entrega", porque e a única
   * que não depende de marcação nenhuma: ela tem produto no minuto em que o
   * catálogo tem, enquanto as outras duas dependem de alguém ter marcado
   * destaque ou pronta entrega no painel. Pronta entrega não sumiu da loja —
   * tem rota própria, selo no card e uma linha na faixa de confiança logo
   * acima desta fileira.
   */
  const slots: Shelf[] = [
    {
      key: 'best-sellers',
      title: 'Mais vendidos',
      description: 'O que mais saiu nas últimas semanas.',
      to: ROUTES.products,
      linkLabel: 'Ver todos',
      content: contentOf(bestSellers),
    },
    {
      key: 'sale',
      title: 'Aproveite as promoções',
      description: 'Preço menor enquanto durar o estoque.',
      to: ROUTES.productsOnSale,
      linkLabel: 'Ver todas as promoções',
      content: contentOf(sale),
    },
    {
      key: 'latest',
      title: 'Compre também',
      description: 'O que acabou de chegar na loja.',
      to: ROUTES.products,
      linkLabel: 'Ver todos os produtos',
      content: contentOf(latest),
    },
    {
      key: 'ready-to-ship',
      title: 'Pronta entrega',
      description: 'Em mãos agora: retire em Juazeiro do Norte ou receba primeiro.',
      to: ROUTES.readyToShip,
      linkLabel: 'Ver tudo em pronta entrega',
      content: contentOf(readyToShip),
    },
  ];

  const shelves = slots.filter((shelf) => shelfWillRender(shelf.content)).slice(0, MAX_SHELVES);

  /*
   * As marcas saem dos produtos que esta página já carregou.
   *
   * Nenhuma consulta nova: a faixa mostra as marcas que estão nas fileiras
   * acima dela, que são exatamente as que o cliente acabou de ver passar.
   */
  const shown: PublicProduct[] = shelves.flatMap((shelf) => shelf.content.products ?? []);

  /**
   * O que entra depois de cada fileira.
   *
   * Por posição, e não por prateleira: qual fileira ocupa a primeira vaga
   * depende do que a loja tem cadastrado, e as seções intercaladas precisam
   * cair no mesmo lugar da página em qualquer caso.
   */
  const between = [
    <Fragment key="brands">
      {/*
        Marcas e cartazes andam juntos, na mesma vaga.

        E o par da referência: a faixa de nomes diz de quem e o catálogo, e os
        cartazes logo abaixo dão para onde ir. Separados — cartazes uma
        fileira adiante, como estavam —, a faixa de marcas ficava sozinha
        entre duas prateleiras, baixa demais para separar uma da outra.
      */}
      <BrandRow products={shown} />
      <CollectionPosters />
    </Fragment>,
    <Fragment key="trust">
      {/*
        A faixa da home e a do rodapé não dizem a mesma coisa.

        Elas ficam a pouco mais de uma tela de distancia, e com os quatro
        selos idênticos nas duas a página passava a sensação de ter sido
        montada duas vezes. O conjunto `home` gasta os quatro slots no que
        esta loja tem de diferente — incluindo o atendimento um a um, que a
        dona nomeou como diferencial e que não aparecia em lugar nenhum da
        vitrine; o do rodapé fecha a loja e termina em "site seguro".
        Ver `trust-badges.tsx`.
      */}
      <Container>
        <TrustBadges tone="light" set="home" />
      </Container>
    </Fragment>,
  ];

  return (
    <>
      <HomeHero />
      <CategoryCircles />

      {shelves.map((shelf, index) => (
        <Fragment key={shelf.key}>
          <ProductShelf
            title={shelf.title}
            description={shelf.description}
            products={shelf.content.products}
            isLoading={shelf.content.isLoading}
            isError={shelf.content.isError}
            to={shelf.to}
            linkLabel={shelf.linkLabel}
            /*
              A do meio empilha; as outras duas rolam.

              Por posição, e não por prateleira — qual fileira ocupa a vaga do
              meio depende do que a loja tem cadastrado, e o ritmo da página
              precisa ser o mesmo em qualquer caso. Com as três rolando, a
              home pedia o mesmo gesto três vezes e a do meio sumia entre as
              vizinhas; com a do meio aberta, a página tem um começo, um lugar
              onde para, e um fim.
            */
            layout={index === 1 ? 'grid' : 'carousel'}
          />

          {between[index] ?? null}
        </Fragment>
      ))}

      {/*
        Com o catalogo vazio não há fileira nenhuma, e as seções intercaladas
        nunca seriam desenhadas: a home cairia do banner direto no perfume da
        vez. A faixa de marcas depende dos produtos das fileiras e não teria o
        que mostrar, mas os cartazes saem das categorias e continuam de pe.
      */}
      {shelves.length === 0 ? <CollectionPosters /> : null}

      {/*
        A faixa de banner ocupa a vaga da antiga quinta fileira.

        Ela fica fora do `between` de propósito: aquelas seções dependem de
        uma prateleira ter aparecido antes delas, e esta não pode depender —
        a dona pôs uma campanha no ar e ela precisa aparecer inclusive na
        loja que ainda não tem três fileiras para mostrar. Quando não há
        banner do meio cadastrado, `HomeBanner` devolve nada e a home segue
        da última fileira direto para o Instagram, como antes.
      */}
      <HomeBanner />

      {/*
        O Instagram vem antes do perfume da vez, como na referência.

        Os dois fecham a página, e a ordem entre eles decide com o que a
        pessoa sai: com um convite para seguir, ou com um produto e um botão
        de comprar. A loja vive de pedido fechado no site — então quem fala
        por último e o produto.

        A faixa do Instagram tambem e a transição certa para ele: ela e larga,
        escura e sem preço, e separa a última fileira do bloco de venda sem
        parecer mais uma prateleira.
      */}
      <InstagramInvite />

      {/*
        E o perfume da vez encosta no rodapé de propósito.

        Havia um espacador de 64px antes da última seção, para ela não
        encostar na laje preta. Somado ao respiro que a própria seção já tem
        embaixo, isso dava quase cem pixels de branco entre a última linha de
        conteúdo e o rodapé — e o rodapé desta loja não e um rodapé qualquer:
        ele tem a newsletter, o contato e as páginas institucionais.
        Empurrá-lo para longe com um vazio e empurrar o que a pessoa desceu
        para encontrar.
      */}
      <FeaturedPerfume />
    </>
  );
}

/**
 * O resultado da consulta reduzido ao que decide se a prateleira aparece.
 *
 * Serve as cinco. Não pede `ReturnType<typeof useShelf>` de propósito: o que
 * a home precisa de uma consulta são três campos, e exigir o tipo inteiro do
 * `useQuery` amarraria a página a uma implementação de hook que pode mudar.
 */
function contentOf(query: {
  data: PublicProduct[] | undefined;
  isLoading: boolean;
  isError: boolean;
}): ShelfContent {
  return { products: query.data, isLoading: query.isLoading, isError: query.isError };
}
