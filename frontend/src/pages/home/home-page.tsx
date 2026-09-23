import { ROUTES } from '@/app/routes';
import { ProductShelf } from '@/components/store';
import { useShelf } from '@/features/catalog';
import { BrandStatement } from './brand-statement';
import { CategoryStrip } from './category-strip';
import { HomeHero } from './home-hero';

/**
 * A vitrine.
 *
 * ## A ordem das secoes
 *
 * Nao e arbitraria, e a de maior peso e a quinta. **Pronta entrega vem antes
 * de mais vendidos** porque e o que de fato vende aqui: quem compra perfume
 * numa loja pequena do interior quer saber o que da para levar hoje, e nao o
 * que a loja mais vendeu no trimestre. Destaques vem antes das duas por ser
 * a prateleira que a dona controla a mao — e a vitrine da frente.
 *
 * ## Por que nao ha uma consulta so
 *
 * Cada prateleira chama a sua rota. Poderiam ser uma chamada unica que
 * devolvesse tudo, e seria uma requisicao em vez de tres — mas as tres sao
 * independentes, saem em paralelo, tem cache de borda proprio e falham
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
  const readyToShip = useShelf('ready-to-ship');
  const bestSellers = useShelf('best-sellers');

  return (
    <>
      <HomeHero />

      <ProductShelf
        title="Destaques"
        description="A selecao da casa, trocada com frequencia."
        products={featured.data}
        isLoading={featured.isLoading}
        isError={featured.isError}
        to={ROUTES.products}
        linkLabel="Ver todos os produtos"
      />

      {/* As colecoes vem depois da primeira prateleira, e nao antes dela.
          Quem chega pelo banner quer ver produto, nao uma segunda tela de
          navegacao: as categorias respondem "o que mais voce tem", que e a
          pergunta de quem ja olhou a vitrine e nao se decidiu. */}
      <CategoryStrip />

      <BrandStatement />

      <ProductShelf
        title="Pronta entrega"
        description="Em maos agora: retire em Juazeiro do Norte ou receba primeiro."
        products={readyToShip.data}
        isLoading={readyToShip.isLoading}
        isError={readyToShip.isError}
        to={ROUTES.readyToShip}
        linkLabel="Ver tudo em pronta entrega"
        tinted
      />

      <ProductShelf
        title="Mais vendidos"
        description="O que mais saiu nas ultimas semanas."
        products={bestSellers.data}
        isLoading={bestSellers.isLoading}
        isError={bestSellers.isError}
        to={ROUTES.products}
      />

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
