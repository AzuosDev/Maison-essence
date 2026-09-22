import { ROUTES } from '@/app/routes';
import { ButtonLink, Skeleton } from '@/components/ui';
import { useStoreSettings, type PublicBanner } from '@/features/settings';
import { imageProps, imageSrcSet } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { useCarousel } from './use-carousel';
import styles from './home-hero.module.css';

/**
 * O hero da home: o carrossel dos banners cadastrados.
 *
 * Os banners vem de `GET /settings`, ja filtrados pelo agendamento — o
 * backend so devolve os vigentes. Nao ha consulta propria aqui: o layout da
 * loja busca as configuracoes uma vez e o contexto as distribui, entao o hero
 * desenha com o que a moldura ja tinha em maos. E o que faz a dona trocar um
 * banner no painel e ver a home mudar sem nenhum redeploy.
 *
 * ## LCP
 *
 * A foto do primeiro banner e, quase sempre, o maior elemento da primeira
 * tela — ou seja, e o LCP. Ela sai com `loading="eager"` e
 * `fetchPriority="high"`; as outras ficam em `lazy`. Prioridade em todas e
 * prioridade em nenhuma: as quatro disputariam a mesma banda de uma conexao
 * 3G e a primeira chegaria por ultimo.
 *
 * As duas fotos — desktop e celular — sao arquivos diferentes, escolhidos por
 * `<picture>` com `media`. O celular baixa a versao retrato e nunca ve a
 * panoramica de 1200px.
 */
export function HomeHero() {
  const { settings, isLoading } = useStoreSettings();
  const banners = settings?.banners ?? [];
  const carousel = useCarousel(banners.length);

  if (isLoading && banners.length === 0) {
    return <HeroSkeleton />;
  }

  if (banners.length === 0) {
    return <HeroFallback storeName={settings?.storeName ?? 'Maison Essence'} />;
  }

  return (
    // O carrossel inteiro e a area que pausa e que ouve as setas, e nao um
    // controle dentro dele: o cliente passa o mouse sobre a foto, nao sobre o
    // indicador. O equivalente para quem nao usa mouse esta coberto — os
    // indicadores sao botoes de verdade, e as setas chegam aqui por
    // borbulhamento quando o foco esta em um deles.
    // oxlint-disable-next-line no-noninteractive-element-interactions
    <section
      className={styles.hero}
      aria-roledescription="carrossel"
      aria-label="Destaques da loja"
      // Passar o mouse, ou chegar de Tab, suspende o giro. Os quatro eventos
      // borbulham dos filhos, que e onde o cliente de fato esta.
      onMouseEnter={carousel.suspend}
      onMouseLeave={carousel.resume}
      onFocus={carousel.suspend}
      onBlur={carousel.resume}
      onKeyDown={carousel.onKeyDown}
    >
      <div
        className={styles.viewport}
        // Enquanto gira sozinho, a troca nao e anunciada: o leitor de tela
        // interromperia a leitura a cada seis segundos. Com o giro suspenso,
        // a troca foi pedida por quem esta ali e merece ser confirmada.
        aria-live={carousel.paused ? 'polite' : 'off'}
      >
        {banners.map((banner, position) => (
          <Slide
            key={banner.id}
            banner={banner}
            position={position}
            total={banners.length}
            active={position === carousel.index}
          />
        ))}
      </div>

      {/* Sem rotulo de grupo em volta dos indicadores: cada botao ja diz
          "Banner 2 de 3", que e a informacao inteira. Um `role="group"` so
          acrescentaria mais um nivel para quem navega por marcos. */}
      {banners.length > 1 ? (
        <div className={styles.indicators}>
          {banners.map((banner, position) => (
            <button
              key={banner.id}
              type="button"
              className={cx(
                styles.indicator,
                position === carousel.index && styles.indicatorActive,
              )}
              aria-label={`Banner ${position + 1} de ${banners.length}`}
              aria-current={position === carousel.index || undefined}
              onClick={() => {
                carousel.goTo(position);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface SlideProps {
  banner: PublicBanner;
  position: number;
  total: number;
  active: boolean;
}

/**
 * Um banner do carrossel.
 *
 * O slide inativo esta com `visibility: hidden`, e por isso os links dele ja
 * saem da ordem do Tab sozinhos. O `aria-hidden` completa o par para quem nao
 * enxerga o que esta escondido, e o `tabIndex` do botao fecha a brecha do
 * navegador que ignorar a visibilidade.
 */
function Slide({ banner, position, total, active }: SlideProps) {
  return (
    <div
      className={cx(styles.slide, active && styles.slideActive)}
      aria-roledescription="slide"
      aria-label={`${position + 1} de ${total}`}
      aria-hidden={!active}
    >
      <div className={styles.media}>
        <BannerImage banner={banner} priority={position === 0} />
      </div>

      <div className={cx(styles.panel, 'on-dark')}>
        <p className={styles.eyebrow}>Selecao Maison Essence</p>

        {/* O `<h1>` da home. Os slides seguintes repetem a marcacao, mas so
            um deles esta visivel por vez. */}
        <h1 className={styles.title}>{banner.title}</h1>

        {banner.subtitle === '' ? null : <p className={styles.subtitle}>{banner.subtitle}</p>}

        {banner.buttonLabel === '' ? null : (
          <ButtonLink
            to={banner.link === '' ? ROUTES.products : banner.link}
            variant="secondary"
            className={styles.action}
            tabIndex={active ? undefined : -1}
          >
            {banner.buttonLabel}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

/**
 * A foto do banner, em dois arquivos.
 *
 * `alt=""` de proposito: o titulo e o subtitulo do banner estao no DOM, ao
 * lado. Repetir o texto no `alt` faria o leitor de tela anunciar a mesma
 * frase duas vezes.
 */
function BannerImage({ banner, priority }: { banner: PublicBanner; priority: boolean }) {
  const desktop = imageSrcSet(banner.imageDesktop);
  const mobile = banner.imageMobile === '' ? banner.imageDesktop : banner.imageMobile;

  return (
    <picture>
      {desktop ? <source media="(min-width: 64rem)" srcSet={desktop} sizes="60vw" /> : null}

      <img
        {...imageProps(mobile, 'detail', '100vw')}
        alt=""
        className={styles.image}
        width={1200}
        height={1500}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  );
}

/**
 * O hero enquanto `GET /settings` nao respondeu.
 *
 * Reusa `.slide`, `.media` e as medidas do painel, entao ocupa exatamente a
 * altura do hero de verdade: quando os banners chegam, a pagina ganha cor e
 * nao se mexe.
 */
function HeroSkeleton() {
  return (
    <div className={styles.hero} aria-busy="true">
      <div className={styles.viewport}>
        <div className={cx(styles.slide, styles.slideActive)}>
          <div className={styles.media}>
            <Skeleton width="100%" height="100%" />
          </div>

          <div className={styles.ghostPanel}>
            <Skeleton width="45%" height="0.75rem" />
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
 * O hero sem banner nenhum.
 *
 * Acontece em loja recem-montada e nos dias entre o fim de uma campanha e o
 * inicio da proxima — o backend so devolve banner vigente. Uma home que
 * comecasse direto na faixa de categorias pareceria quebrada; este bloco
 * ocupa o lugar com a marca e um caminho para a vitrine, e desaparece assim
 * que a dona publicar o primeiro banner.
 */
function HeroFallback({ storeName }: { storeName: string }) {
  return (
    <section className={cx(styles.hero, 'on-dark')}>
      <div className={styles.panel}>
        <p className={styles.eyebrow}>{storeName}</p>
        <h1 className={styles.title}>Perfumes e velas selecionados</h1>

        <p className={styles.subtitle}>
          Uma selecao curta, escolhida peca a peca. Veja o que esta disponivel agora.
        </p>

        <ButtonLink to={ROUTES.products} variant="secondary" className={styles.action}>
          Ver a vitrine
        </ButtonLink>
      </div>
    </section>
  );
}
