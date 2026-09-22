import { ROUTES } from '@/app/routes';
import { DeferredNewsletter, ProductShelf, TrustBadges } from '@/components/store';
import { Container } from '@/components/ui';
import { useShelf } from '@/features/catalog';
import { BrandStatement } from './brand-statement';
import { CategoryStrip } from './category-strip';
import { HomeHero } from './home-hero';
import styles from './home-page.module.css';

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

      <CategoryStrip />

      <ProductShelf
        title="Destaques"
        description="A selecao da casa, trocada com frequencia."
        products={featured.data}
        isLoading={featured.isLoading}
        isError={featured.isError}
        to={ROUTES.products}
        linkLabel="Ver todos os produtos"
      />

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

      <section className={styles.trust} aria-label="Como a loja trabalha">
        <Container>
          <TrustBadges tone="light" />
        </Container>
      </section>

      <section className={styles.newsletter} aria-label="Newsletter">
        <Container>
          {/* Sem cabecalho de secao aqui: o proprio formulario ja traz o
              titulo e a linha de apoio dele, e repeti-los acima faria a
              faixa anunciar "Receba as novidades" duas vezes. */}
          <div className={styles.newsletterInner}>
            <DeferredNewsletter tone="light" />
          </div>
        </Container>
      </section>
    </>
  );
}
