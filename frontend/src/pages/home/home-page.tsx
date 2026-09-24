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
 * Depois de quantas prateleiras entram as coleções e a assinatura da marca.
 *
 * Quem chega pelo banner veio ver perfume, e as coleções respondem "o que
 * mais você tem" — que e a pergunta de quem já passou os olhos pela vitrine e
 * não se decidiu. Uma prateleira só não e vitrine suficiente para justificar
 * a pergunta.
 *
 * Três, e não duas: as três primeiras são o bloco de marcas, e a faixa de
 * coleções com a assinatura preta atrás dela entrando entre a segunda e a
 * terceira partia o bloco ao meio — duas marcas, uma parede escura, mais uma
 * marca. O número acompanha o tamanho do bloco de abertura; não e uma
 * preferência por "três prateleiras antes de navegar".
 */
const SECTIONS_BEFORE_COLLECTIONS = 3;

/**
 * As marcas que ganham prateleira própria, escritas como estão no cadastro.
 *
 * Texto literal porque marca e campo livre no painel: não há tabela de
 * marcas, e o filtro do backend casa a marca inteira ignorando maiúscula. O
 * preço disso e que renomear "Lattafa" para "Lattafa Perfumes" no painel
 * esvazia a prateleira — e, como prateleira vazia some, ela desapareceria da
 * home sem nenhum erro. Ficam aqui, juntas e nomeadas, para que esse dia seja
 * uma edição obvia num lugar só.
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
   * Existe por causa das prateleiras de marca, que trazem cinco: com o padrão
   * de oito, a fileira nascia com oito cards em branco e encolhia para cinco
   * quando a resposta chegava — e as setas acendiam e apagavam junto.
   */
  skeletonCount?: number;
}

/**
 * A vitrine.
 *
 * ## A ordem das seções
 *
 * Banner, as três prateleiras de marca, as coleções, a assinatura da marca e
 * as três prateleiras de venda.
 *
 * **As marcas abrem a vitrine.** Quem chega pelo banner vê primeiro de quem
 * e o que a loja vende, e só depois a curadoria da casa. E uma inversão em
 * relação ao arranjo anterior, onde "Destaques" — a prateleira que a dona
 * marca a mão — encostava no banner.
 *
 * **Pronta entrega vem antes de mais vendidos** porque e o que de fato vende
 * aqui: quem compra perfume numa loja pequena do interior quer saber o que da
 * para levar hoje, e não o que a loja mais vendeu no trimestre. Destaques vem
 * antes das duas por ser a prateleira que a dona controla a mão.
 *
 * **As três de marca são a rede de segurança da página.** Destaque e pronta
 * entrega saem de marcação no painel e mais vendidos sai do histórico de
 * pedidos: as três respondem vazio numa loja que acabou de subir o catálogo,
 * e foi o que aconteceu uma vez — catálogo inteiro cadastrado, nenhum produto
 * marcado, nenhum pedido, e a home abria no banner e ia direto para as
 * coleções. As de marca saem do próprio catálogo e tem produto no minuto em
 * que o catálogo tem.
 *
 * O papel era de "Novidades", que ficava em terceiro e foi retirada daqui. A
 * diferença que isso faz: novidades dependia só de existir produto, e estas
 * dependem de a marca estar escrita no cadastro como esta em `BRANDS`. Ver o
 * comentário de lá.
 *
 * A assinatura da marca fica entre as coleções e a última prateleira, e não
 * no fim da página: ela e preta, o rodapé também, e uma encostada no outro
 * viram um bloco escuro só com dois textos dentro.
 *
 * ## Por que as posições se resolvem em tempo de execução
 *
 * `ProductShelf` some quando não há produto — prateleira vazia não vira seção
 * com um título e o nada embaixo. Só que isso muda a página: numa loja sem
 * nenhum destaque marcado, a home montada a mão desenhava o banner e, logo
 * embaixo, as coleções. A faixa que deveria ser a terceira seção virava a
 * primeira, e o cliente batia no banner e numa tela de navegação sem ter
 * visto um perfume.
 *
 * Por isso a lista e filtrada antes de desenhar: as posições valem sobre as
 * prateleiras que de fato aparecem, e não sobre as que foram escritas aqui.
 * Quem encosta no banner e a primeira que sobrou, e as coleções entram depois
 * da terceira.
 *
 * ## Por que não há uma consulta só
 *
 * Cada prateleira chama a sua rota. Poderiam ser uma chamada única que
 * devolvesse tudo, e seria uma requisição em vez de sete — mas elas são
 * independentes, saem em paralelo, tem cache de borda próprio e falham
 * separadas. Com a chamada única, um erro em "mais vendidos" apagaria os
 * destaques junto.
 *
 * Sete e não seis porque a terceira prateleira consulta duas marcas: o filtro
 * de marca do backend aceita uma por vez (ver `useBrandsShelf`).
 *
 * ## Layout que não salta
 *
 * Toda seção ocupa a altura final desde o primeiro quadro: o hero pela
 * proporção fixa da foto, as prateleiras pelos esqueletos — que são o próprio
 * card com as linhas em branco — e a faixa de categorias pelo card de mesma
 * proporção. O único dado que chega depois e o parcelamento, e a linha dele
 * já vem com altura reservada no card.
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
     * As marcas abrem a página, em bloco e encostadas no banner.
     *
     * Três fileiras seguidas de nome de marca só funcionam juntas: separadas
     * por uma prateleira de venda no meio, elas parariam de se ler como "as
     * marcas da casa" e virariam três seções soltas repetindo o mesmo
     * formato. Por isso as três andam coladas, e a faixa de coleções espera
     * as três passarem (ver `SECTIONS_BEFORE_COLLECTIONS`).
     *
     * Cada uma leva para a vitrine já filtrada pela marca — a prateleira e
     * amostra de cinco, não o acervo.
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
      description: 'Os árabes em miniatura de 25ml.',
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
       * Para a vitrine inteira, e não para uma das duas marcas.
       *
       * O filtro da vitrine e de uma marca por vez, então não há endereço que
       * mostre exatamente esta fileira. Mandar para uma das duas escolheria a
       * dedo qual metade da prateleira o cliente perde no clique; a vitrine
       * abre com o filtro de marca a mão e ele escolhe.
       */
      to: ROUTES.products,
      linkLabel: 'Ver a vitrine e filtrar por marca',
      content: contentOf(houseBrands),
      skeletonCount: BRAND_SHELF_LIMIT,
    },

    /* As de venda, depois das coleções: a curadoria da casa vem quando o
       cliente já sabe de quem são os perfumes. */
    {
      key: 'featured',
      title: 'Destaques',
      description: 'A seleção da casa, trocada com frequência.',
      to: ROUTES.products,
      linkLabel: 'Ver todos os produtos',
      content: contentOf(featured),
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
      key: 'best-sellers',
      title: 'Mais vendidos',
      description: 'O que mais saiu nas últimas semanas.',
      to: ROUTES.products,
      linkLabel: 'Ver todos',
      content: contentOf(bestSellers),
    },
  ];

  const visible = shelves.filter((shelf) => shelfWillRender(shelf.content));

  /*
   * Depois de qual das prateleiras visíveis entram as coleções.
   *
   * O mínimo, e não a constante direto: numa loja com uma prateleira só,
   * esperar pela segunda jogaria as coleções para o fim da página. `-1` no
   * fim porque o que se compara e o índice.
   *
   * Com nenhuma prateleira visível o valor e -1 e não casa com índice nenhum
   * — que e o certo, porque aí as coleções já saem antes do laço.
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
            // seções de mesmo tom, e contra a foto escura ele só empurra o
            // produto para fora da primeira tela.
            flush={index === 0}
            /*
             * O fundo em areia alterna por posição, e não por prateleira: e o
             * que garante que duas fileiras seguidas nunca saiam no mesmo
             * tom, mesmo quando uma delas não tem produto e some.
             *
             * A conta e feita **a partir da faixa de coleções**, e não da
             * primeira prateleira. A faixa não tem fundo próprio — ela e o
             * creme da página —, então a fileira imediatamente acima dela
             * precisa ser a de areia; sendo creme, as duas encostam sem
             * nenhuma mudanca de tom e a vitrine parece continuar dentro da
             * faixa. Contando da primeira, isso dependia de quantas
             * prateleiras havia antes da faixa: com quatro dava certo, com as
             * três de marca dava errado.
             *
             * Do outro lado da faixa não há o que resolver: a assinatura da
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
 * Serve as sete. Não pede `ReturnType<typeof useShelf>` de propósito: o que
 * a home precisa de uma consulta são três campos, e exigir o tipo inteiro do
 * `useQuery` deixaria de fora a prateleira de duas marcas, que nasce de um
 * `useQueries` combinado e não e um `useQuery`. Com a forma mínima, a home
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
 * As coleções e a assinatura da marca, que andam juntas.
 *
 * São duas seções, não uma, mas nunca aparecem separadas: a assinatura existe
 * para responder "quem e essa loja de quem eu nunca ouvi falar?", e o lugar
 * dela e depois de o cliente ter visto o que a loja vende e como ela se
 * organiza. Mante-las num componente só e o que impede que um remanejamento
 * futuro mande o preto da assinatura encostar no preto do rodapé.
 */
function Collections({ flush = false }: { flush?: boolean }) {
  return (
    <>
      <CategoryStrip flush={flush} />
      <BrandStatement />
    </>
  );
}
