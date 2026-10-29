import { ROUTES } from '@/app/routes';
import { ButtonLink, Skeleton } from '@/components/ui';
import { useStoreSettings } from '@/features/settings';
import { cx } from '@/lib/cx';
import { BannerCarousel } from './banner-carousel';
import styles from './banner-carousel.module.css';

/**
 * O hero da home: o carrossel dos banners do topo.
 *
 * Os banners vem de `GET /settings`, já filtrados pelo agendamento — o
 * backend só devolve os vigentes. Não há consulta própria aqui: o layout da
 * loja busca as configurações uma vez e o contexto as distribui, então o hero
 * desenha com o que a moldura já tinha em mãos. E o que faz a dona trocar um
 * banner no painel e ver a home mudar sem nenhum redeploy.
 *
 * Só os banners da vaga do topo entram. A dona escolhe a vaga no painel, e a
 * faixa do meio da página lê a mesma lista pelo outro lado do filtro — ver
 * `home-banner.tsx`.
 *
 * ## LCP
 *
 * A foto do primeiro banner e, quase sempre, o maior elemento da primeira
 * tela — ou seja, e o LCP. Quem cuida disso e o `lead` do carrossel: ele sai
 * com `loading="eager"` e `fetchPriority="high"`, e as outras fotos da página
 * ficam em `lazy`. Prioridade em todas e prioridade em nenhuma: as quatro
 * disputariam a mesma banda de uma conexão 3G e a primeira chegaria por
 * último.
 */
export function HomeHero() {
  const { settings, isLoading } = useStoreSettings();
  const storeName = settings?.storeName ?? 'Maison Essence';
  const banners = (settings?.banners ?? []).filter((banner) => banner.placement === 'hero');

  if (isLoading && banners.length === 0) {
    return <HeroSkeleton />;
  }

  if (banners.length === 0) {
    return <HeroFallback storeName={storeName} />;
  }

  return (
    <BannerCarousel banners={banners} label="Destaques da loja" lead storeName={storeName} />
  );
}

/**
 * O hero enquanto `GET /settings` não respondeu.
 *
 * Reusa `.slide`, `.media` e as medidas do painel, então ocupa exatamente a
 * altura do hero de verdade: quando os banners chegam, a página ganha cor e
 * não se mexe.
 */
function HeroSkeleton() {
  return (
    <div className={styles.carousel} aria-busy="true">
      <div className={styles.viewport}>
        <div className={cx(styles.slide, styles.slideActive)}>
          <div className={styles.media}>
            <Skeleton width="100%" height="100%" />
          </div>

          <div className={styles.ghostPanel}>
            <Skeleton width="85%" height="2.25rem" />
            <Skeleton width="70%" height="1rem" />
            <Skeleton width="10rem" height="var(--control-height)" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * O hero sem banner nenhum no topo.
 *
 * Acontece em loja recém-montada e nos dias entre o fim de uma campanha e o
 * início da próxima — o backend só devolve banner vigente. Uma home que
 * comecasse direto na faixa de categorias pareceria quebrada; este bloco
 * ocupa o lugar com a marca e um caminho para a vitrine, e desaparece assim
 * que a dona publicar o primeiro banner.
 */
function HeroFallback({ storeName }: { storeName: string }) {
  return (
    <section className={cx(styles.carousel, styles.fallback, 'on-dark')} aria-label={storeName}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Perfumes e velas selecionados</h1>

        <p className={styles.subtitle}>
          Uma seleção curta, escolhida peça a peça. Veja o que esta disponível agora.
        </p>

        <ButtonLink to={ROUTES.products} className={styles.action}>
          Ver a vitrine
        </ButtonLink>
      </div>
    </section>
  );
}
