import { Fragment } from 'react';
import { ROUTES } from '@/app/routes';
import { ProductShelf, shelfWillRender, type ShelfContent } from '@/components/store';
import {
  BRAND_SHELF_LIMIT,
  useBrandShelf,
  useBrandsShelf,
  useShelf,
  type PublicProduct,
} from '@/features/catalog';
import { BrandStatement } from './brand-statement';
import { CategoryStrip } from './category-strip';
import { HomeHero } from './home-hero';

/**
 * Depois de quantas prateleiras entram as colecoes e a assinatura da marca.
 *
 * Quem chega pelo banner veio ver perfume, e as colecoes respondem "o que
 * mais voce tem" — que e a pergunta de quem ja passou os olhos pela vitrine e
 * nao se decidiu. Uma prateleira so nao e vitrine suficiente para justificar
 * a pergunta.
 *
 * Tres, e nao duas: as tres primeiras sao o bloco de marcas, e a faixa de
 * colecoes com a assinatura preta atras dela entrando entre a segunda e a
 * terceira partia o bloco ao meio — duas marcas, uma parede escura, mais uma
 * marca. O numero acompanha o tamanho do bloco de abertura; nao e uma
 * preferencia por "tres prateleiras antes de navegar".
 */
const SECTIONS_BEFORE_COLLECTIONS = 3;

/**
 * As marcas que ganham prateleira propria, escritas como estao no cadastro.
 *
 * Texto literal porque marca e campo livre no painel: nao ha tabela de
 * marcas, e o filtro do backend casa a marca inteira ignorando maiuscula. O
 * preco disso e que renomear "Lattafa" para "Lattafa Perfumes" no painel
 * esvazia a prateleira — e, como prateleira vazia some, ela desapareceria da
 * home sem nenhum erro. Ficam aqui, juntas e nomeadas, para que esse dia seja
 * uma edicao obvia num lugar so.
 */
const BRANDS = {
  isabelle: 'Isabelle La Belle',
  arabic: 'Arabic Collection',
  alhambra: 'Maison Alhambra',
  lattafa: 'Lattafa',
} as const;

interface Shelf {
  key: string;
  title: string;
  description: string;
  to: string;
  linkLabel: string;
  content: ShelfContent;
  /**
   * Quantos esqueletos desenhar enquanto carrega.
   *
   * Existe por causa das prateleiras de marca, que trazem cinco: com o padrao
   * de oito, a fileira nascia com oito cards em branco e encolhia para cinco
   * quando a resposta chegava — e as setas acendiam e apagavam junto.
   */
  skeletonCount?: number;
}

/**
 * A vitrine.
 *
 * ## A ordem das secoes
 *
 * Banner, as tres prateleiras de marca, as colecoes, a assinatura da marca e
 * as tres prateleiras de venda.
 *
 * **As marcas abrem a vitrine.** Quem chega pelo banner ve primeiro de quem
 * e o que a loja vende, e so depois a curadoria da casa. E uma inversao em
 * relacao ao arranjo anterior, onde "Destaques" — a prateleira que a dona
 * marca a mao — encostava no banner.
 *
 * **Pronta entrega vem antes de mais vendidos** porque e o que de fato vende
 * aqui: quem compra perfume numa loja pequena do interior quer saber o que da
 * para levar hoje, e nao o que a loja mais vendeu no trimestre. Destaques vem
 * antes das duas por ser a prateleira que a dona controla a mao.
 *
 * **As tres de marca sao a rede de seguranca da pagina.** Destaque e pronta
 * entrega saem de marcacao no painel e mais vendidos sai do historico de
 * pedidos: as tres respondem vazio numa loja que acabou de subir o catalogo,
 * e foi o que aconteceu uma vez — catalogo inteiro cadastrado, nenhum produto
 * marcado, nenhum pedido, e a home abria no banner e ia direto para as
 * colecoes. As de marca saem do proprio catalogo e tem produto no minuto em
 * que o catalogo tem.
 *
 * O papel era de "Novidades", que ficava em terceiro e foi retirada daqui. A
 * diferenca que isso faz: novidades dependia so de existir produto, e estas
 * dependem de a marca estar escrita no cadastro como esta em `BRANDS`. Ver o
 * comentario de la.
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
 * da terceira.
 *
 * ## Por que nao ha uma consulta so
 *
 * Cada prateleira chama a sua rota. Poderiam ser uma chamada unica que
 * devolvesse tudo, e seria uma requisicao em vez de sete — mas elas sao
 * independentes, saem em paralelo, tem cache de borda proprio e falham
 * separadas. Com a chamada unica, um erro em "mais vendidos" apagaria os
 * destaques junto.
 *
 * Sete e nao seis porque a terceira prateleira consulta duas marcas: o filtro
 * de marca do backend aceita uma por vez (ver `useBrandsShelf`).
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
  const readyToShip = useShelf('ready-to-ship');
  const bestSellers = useShelf('best-sellers');

  const isabelle = useBrandShelf(BRANDS.isabelle, BRAND_SHELF_LIMIT);
  const arabic = useBrandShelf(BRANDS.arabic, BRAND_SHELF_LIMIT);
  const houseBrands = useBrandsShelf([BRANDS.alhambra, BRANDS.lattafa], BRAND_SHELF_LIMIT);

  const shelves: Shelf[] = [
    /*
     * As marcas abrem a pagina, em bloco e encostadas no banner.
     *
     * Tres fileiras seguidas de nome de marca so funcionam juntas: separadas
     * por uma prateleira de venda no meio, elas parariam de se ler como "as
     * marcas da casa" e virariam tres secoes soltas repetindo o mesmo
     * formato. Por isso as tres andam coladas, e a faixa de colecoes espera
     * as tres passarem (ver `SECTIONS_BEFORE_COLLECTIONS`).
     *
     * Cada uma leva para a vitrine ja filtrada pela marca — a prateleira e
     * amostra de cinco, nao o acervo.
     */
    {
      key: 'brand-isabelle',
      title: BRANDS.isabelle,
      description: 'A linha de corpo: body splash, hidratante e pasta hidratante.',
      to: ROUTES.productsByBrand(BRANDS.isabelle),
      linkLabel: `Ver tudo de ${BRANDS.isabelle}`,
      content: contentOf(isabelle),
      skeletonCount: BRAND_SHELF_LIMIT,
    },
    {
      key: 'brand-arabic',
      title: BRANDS.arabic,
      description: 'Os arabes em miniatura de 25ml.',
      to: ROUTES.productsByBrand(BRANDS.arabic),
      linkLabel: `Ver tudo de ${BRANDS.arabic}`,
      content: contentOf(arabic),
      skeletonCount: BRAND_SHELF_LIMIT,
    },
    {
      key: 'brand-house',
      title: `${BRANDS.alhambra} e ${BRANDS.lattafa}`,
      description: 'Body mist de 250ml e desodorantes de 200ml.',

      /*
       * Para a vitrine inteira, e nao para uma das duas marcas.
       *
       * O filtro da vitrine e de uma marca por vez, entao nao ha endereco que
       * mostre exatamente esta fileira. Mandar para uma das duas escolheria a
       * dedo qual metade da prateleira o cliente perde no clique; a vitrine
       * abre com o filtro de marca a mao e ele escolhe.
       */
      to: ROUTES.products,
      linkLabel: 'Ver a vitrine e filtrar por marca',
      content: contentOf(houseBrands),
      skeletonCount: BRAND_SHELF_LIMIT,
    },

    /* As de venda, depois das colecoes: a curadoria da casa vem quando o
       cliente ja sabe de quem sao os perfumes. */
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
            {...(shelf.skeletonCount === undefined
              ? {}
              : { skeletonCount: shelf.skeletonCount })}
            // A primeira encosta no banner: o respiro de cima separa duas
            // secoes de mesmo tom, e contra a foto escura ele so empurra o
            // produto para fora da primeira tela.
            flush={index === 0}
            /*
             * O fundo em areia alterna por posicao, e nao por prateleira: e o
             * que garante que duas fileiras seguidas nunca saiam no mesmo
             * tom, mesmo quando uma delas nao tem produto e some.
             *
             * A conta e feita **a partir da faixa de colecoes**, e nao da
             * primeira prateleira. A faixa nao tem fundo proprio — ela e o
             * creme da pagina —, entao a fileira imediatamente acima dela
             * precisa ser a de areia; sendo creme, as duas encostam sem
             * nenhuma mudanca de tom e a vitrine parece continuar dentro da
             * faixa. Contando da primeira, isso dependia de quantas
             * prateleiras havia antes da faixa: com quatro dava certo, com as
             * tres de marca dava errado.
             *
             * Do outro lado da faixa nao ha o que resolver: a assinatura da
             * marca e preta e separa sozinha.
             */
            tinted={(index - collectionsAfter) % 2 === 0}
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
 * Serve as sete. Nao pede `ReturnType<typeof useShelf>` de proposito: o que
 * a home precisa de uma consulta sao tres campos, e exigir o tipo inteiro do
 * `useQuery` deixaria de fora a prateleira de duas marcas, que nasce de um
 * `useQueries` combinado e nao e um `useQuery`. Com a forma minima, a home
 * trata as sete como prateleira, sem saber de onde cada uma vem.
 */
function contentOf(query: {
  data: PublicProduct[] | undefined;
  isLoading: boolean;
  isError: boolean;
}): ShelfContent {
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
