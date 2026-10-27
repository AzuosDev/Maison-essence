import { Fragment } from 'react';
import { ROUTES } from '@/app/routes';
import { ProductShelf, TrustBadges, shelfWillRender, type ShelfContent } from '@/components/store';
import { Container } from '@/components/ui';
import { useLatest, useSaleShelf, useShelf, type PublicProduct } from '@/features/catalog';
import { BrandRow } from './brand-row';
import { CategoryCircles } from './category-circles';
import { CollectionPosters } from './collection-posters';
import { FeaturedPerfume } from './featured-perfume';
import { HomeHero } from './home-hero';
import { InstagramInvite } from './instagram-invite';

/**
 * A vitrine.
 *
 * ## A ordem das seções
 *
 * Banner, categorias em círculo, fileira, marcas, cartazes de coleção,
 * fileira, selos de confiança, fileira, o perfume da vez, Instagram.
 *
 * E o arranjo que a dona escolheu, e ele não e arbitrário: e a ordem que
 * quase toda loja brasileira de perfume importado usa, e portanto a ordem
 * que a cliente dela já sabe percorrer sem aprender nada. Entre duas
 * fileiras de produto sempre entra uma seção de outra natureza — marcas,
 * cartazes, selos —, porque três fileiras seguidas viram uma só, longa, e o
 * olho para de distinguir onde uma acaba.
 *
 * ## Três fileiras, e quais
 *
 * Três, por decisão da dona. Quais três e o que sobra de uma lista de cinco
 * candidatas, em ordem de prioridade, depois de tirar as que não tem produto
 * — ver `SHELF_SLOTS`.
 *
 * O arranjo anterior tinha seis fileiras, três delas de marca. Marca agora e
 * filtro: o nome leva para a vitrine filtrada, e a faixa de marcas no meio
 * da página faz esse trabalho sem gastar uma fileira inteira por casa.
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
  const featured = useShelf('featured');
  const latest = useLatest();

  /**
   * As cinco candidatas, em ordem de prioridade.
   *
   * As três primeiras são a vitrine que a dona quer: o que mais vende, o que
   * esta em promoção, o que sai hoje. As duas últimas são rede de segurança,
   * e existem por um caso real: uma loja que acabou de subir o catálogo não
   * tem histórico de pedido, não tem desconto cadastrado e não tem nada
   * marcado como pronta entrega — as três primeiras respondem vazio e a home
   * abriria no banner e iria direto para o rodapé.
   *
   * "Novidades" fecha a lista porque e a única que não depende de marcação
   * nenhuma: ela tem produto no minuto em que o catálogo tem.
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
      key: 'ready-to-ship',
      title: 'Pronta entrega',
      description: 'Em mãos agora: retire em Juazeiro do Norte ou receba primeiro.',
      to: ROUTES.readyToShip,
      linkLabel: 'Ver tudo em pronta entrega',
      content: contentOf(readyToShip),
    },
    {
      key: 'featured',
      title: 'A seleção da casa',
      description: 'Escolhidos a dedo, trocados com frequência.',
      to: ROUTES.products,
      linkLabel: 'Ver todos os produtos',
      content: contentOf(featured),
    },
    {
      key: 'latest',
      title: 'Novidades',
      description: 'O que acabou de chegar.',
      to: ROUTES.products,
      linkLabel: 'Ver todos os produtos',
      content: contentOf(latest),
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
    <BrandRow key="brands" products={shown} />,
    <CollectionPosters key="posters" />,
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

      <FeaturedPerfume />

      {/*
        A faixa do Instagram fecha a página e encosta no rodapé de propósito.

        Havia um espacador de 64px aqui, para a faixa não encostar na laje
        preta. Somado ao respiro que a própria faixa já tem embaixo, isso
        dava quase cem pixels de branco entre a última linha de conteúdo e o
        rodapé — e o rodapé desta loja não e um rodapé qualquer: ele tem a
        newsletter, o contato e as páginas institucionais. Empurrá-lo para
        longe com um vazio e empurrar o que a pessoa desceu para encontrar.
      */}
      <InstagramInvite />
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
