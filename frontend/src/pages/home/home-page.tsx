import { Fragment } from 'react';
import { ROUTES } from '@/app/routes';
import { CampaignStrip, ProductShelf, shelfWillRender, type ShelfContent } from '@/components/store';
import { hasShowcase, useCampaignProducts, useLiveCampaign } from '@/features/campaign';
import { useLatest, useSaleShelf, useShelf, type PublicProduct } from '@/features/catalog';
import { BrandRow } from './brand-row';
import { ShortcutCircles } from './shortcut-circles';
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
 * Banner, faixa da campanha (se houver), atalhos em círculo, fileira, marcas,
 * cartazes de coleção, fileira, banner do meio, fileira, Instagram, o perfume
 * da vez.
 *
 * A faixa da campanha e a única seção condicional do topo: ela existe nos dias
 * em que ha promoção no ar e não existe no resto do ano. Fica logo abaixo do
 * banner porque e um prazo, e prazo não espera que alguém pense em procurá-lo
 * — ver `campaign-strip.tsx`, que explica por que ela não e aba de menu nem
 * elemento flutuante.

 *
 * E o arranjo que a dona escolheu, e ele não e arbitrário: e a ordem que
 * quase toda loja brasileira de perfume importado usa, e portanto a ordem
 * que a cliente dela já sabe percorrer sem aprender nada. Entre duas
 * fileiras de produto sempre entra uma seção de outra natureza — marcas e
 * cartazes na primeira vaga, a faixa de banner na segunda —, porque fileiras
 * seguidas viram uma só, longa, e o olho para de distinguir onde uma acaba.
 *
 * A ordem foi conferida contra a referência em 27/10/2026, seção por seção,
 * pela posição de cada bloco no documento dela. Duas trocas sairam daquela
 * conferência: os cartazes subiram para junto das marcas, entre a primeira e
 * a segunda fileira, e o Instagram passou a vir antes do perfume da vez. A
 * faixa de selos, que aquela conferência tinha descido para depois da
 * segunda fileira, saiu da home inteira depois (06/11/2026), e a faixa de
 * banner do meio subiu do fim da página para a vaga que ela deixou.
 *
 * ## Três fileiras, e quais
 *
 * Três, por decisão da dona. Quais três e o que sobra de uma lista de
 * candidatas, em ordem de prioridade, depois de tirar as que não tem produto
 * — ver `slots`.
 *
 * A prateleira da campanha entra como **primeira candidata**, e não como uma
 * quarta fileira: o teto de três e decisão da dona e a promoção não compra o
 * direito de esticar a home. Ela desloca a candidata de menor prioridade, que
 * e o comportamento certo — nos dias de campanha, o que a loja tem a mostrar
 * primeiro e a campanha.
 *
 * Ela só aparece quando o cupom tem produtos escolhidos. Cupom da loja inteira
 * não tem recorte: `?campaign=<slug>` devolveria o catálogo inteiro, e uma
 * prateleira chamada "Black Friday" mostrando tudo seria a loja anunciando um
 * recorte que não existe.
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
 * card com as linhas em branco — e a fileira de atalhos pelos círculos de
 * medida fixa. O único dado que chega depois e o parcelamento, e a linha dele
 * já vem com altura reservada no card.
 */

/** Quantas fileiras de produto a home mostra. Decisão da dona. */
const MAX_SHELVES = 3;

/**
 * Depois de qual fileira cai a faixa de banner do meio.
 *
 * Nomeado porque dois lugares precisam concordar: a posição dela no `between`
 * e a condição que a desenha fora dali quando a loja não tem fileira
 * suficiente para abrir a vaga.
 */
const BANNER_SLOT = 1;

interface Shelf {
  key: string;
  title: string;
  description: string;
  to: string;
  linkLabel: string;
  content: ShelfContent;
}

export default function HomePage() {
  const { data: campaign } = useLiveCampaign();

  /*
   * O slug só vai a consulta quando ha vitrine a montar.
   *
   * `undefined` desliga a consulta dos produtos (`enabled`), que e o caso de
   * toda a loja na maior parte do ano — e o da campanha da loja inteira, que
   * tem faixa mas não tem prateleira própria.
   */
  const campaignSlug =
    campaign != null && hasShowcase(campaign) ? campaign.slug : undefined;
  const campaignProducts = useCampaignProducts(campaignSlug);

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
   * tem rota própria e selo no card, que nasce do cadastro de cada frasco.
   */
  const slots: Shelf[] = [
    ...(campaign != null && campaignSlug !== undefined
      ? [
          {
            key: `campaign-${campaignSlug}`,
            /*
             * O nome da campanha **não** se repete aqui.
             *
             * Ele e o `h2` da faixa, duas seções acima. Repetido no título da
             * prateleira, a home ficaria com dois cabeçalhos de mesmo nome e
             * mesmo nível — e quem navega por cabeçalho ouviria "Black Friday
             * Maison" duas vezes sem saber o que muda entre as duas. A faixa
             * anuncia a campanha; esta fileira mostra o que tem nela, e e isso
             * que o título diz.
             */
            title: 'Os produtos da promoção',
            description:
              campaign.tagline === ''
                ? `${campaign.discountLabel} com o cupom ${campaign.code}.`
                : campaign.tagline,
            to: ROUTES.campaign(campaignSlug),
            linkLabel: 'Ver toda a promoção',
            content: contentOf(campaignProducts),
          },
        ]
      : []),
    {
      key: 'best-sellers',
      title: 'Mais vendidos',
      description: 'O que mais sai das nossas mãos.',
      // Endereço próprio desde que `/mais-vendidos` existe: antes o "ver
      // todos" desta fileira caia no catálogo inteiro, sem ranking nenhum, e
      // quem clicou em "mais vendidos" não encontrava os mais vendidos.
      to: ROUTES.bestSellers,
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
    <Fragment key="banner">
      {/*
        A faixa de banner separa a segunda fileira da terceira.

        Ela vinha depois da última, quase no fim da página, onde herdara a
        vaga da antiga quinta prateleira. Subiu para cá em 06/11/2026, por
        decisão da dona, quando a faixa de selos que ocupava esta vaga saiu:
        sem nada entre a segunda e a terceira fileira, as duas encostavam e
        viravam uma prateleira só, longa.

        A troca não e só tapa-buraco. Uma campanha que a dona compõe no painel
        rende mais no meio da descida, entre dois blocos de produto, do que
        depois da última fileira — onde chegava a quem já tinha decidido
        descer até o fim.
      */}
      <HomeBanner />
    </Fragment>,
  ];

  return (
    <>
      <HomeHero />
      {campaign == null ? null : <CampaignStrip campaign={campaign} />}
      <ShortcutCircles />

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
        A campanha aparece mesmo na loja que não chegou a duas fileiras.

        A vaga dela e entre a segunda e a terceira (`between`), e vaga do
        `between` só existe se a prateleira de antes apareceu. Esta seção não
        pode depender disso: a dona pôs uma campanha no ar e ela precisa estar
        na home inclusive numa loja com uma fileira só, ou com nenhuma. Então
        quando a vaga não chegou a existir, a faixa cai aqui, antes do
        Instagram — que e onde ela ficava até 06/11/2026.

        Sem banner do meio cadastrado, `HomeBanner` devolve nada nos dois
        casos, e a home segue direto.
      */}
      {shelves.length <= BANNER_SLOT ? <HomeBanner /> : null}

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
