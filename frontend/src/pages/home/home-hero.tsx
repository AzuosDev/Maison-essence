import { ROUTES } from '@/app/routes';
import { ButtonLink, Skeleton } from '@/components/ui';
import { ChevronRightIcon } from '@/components/store/icons';
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
            storeName={settings?.storeName ?? 'Maison Essence'}
          />
        ))}
      </div>

      {/* As setas sao a forma que quase todo mundo ja tenta primeiro num
          banner que gira, e elas ficam so onde ha mouse: no toque, quem manda
          e o arrasto e os indicadores, e duas setas sobre a foto comeriam o
          canto da arte numa tela de 390px. */}
      {banners.length > 1 ? (
        <>
          <button
            type="button"
            className={cx(styles.arrow, styles.arrowPrevious)}
            onClick={carousel.previous}
            aria-label="Banner anterior"
          >
            <ChevronRightIcon width="18" height="18" />
          </button>

          <button
            type="button"
            className={cx(styles.arrow, styles.arrowNext)}
            onClick={carousel.next}
            aria-label="Próximo banner"
          >
            <ChevronRightIcon width="18" height="18" />
          </button>
        </>
      ) : null}

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
  /** Vira o `<h1>` invisivel quando a arte do banner ja traz o titulo dentro dela. */
  storeName: string;
}

/**
 * Um banner do carrossel.
 *
 * O slide inativo esta com `visibility: hidden`, e por isso os links dele ja
 * saem da ordem do Tab sozinhos. O `aria-hidden` completa o par para quem nao
 * enxerga o que esta escondido, e o `tabIndex` do botao fecha a brecha do
 * navegador que ignorar a visibilidade.
 */
function Slide({ banner, position, total, active, storeName }: SlideProps) {
  // Banner que ja traz logo, frase e botao desenhados dentro da propria arte
  // chega aqui sem texto nenhum cadastrado. Dar a ele a grade de duas colunas
  // deixaria metade do hero preta e vazia, com o rotulo solto no meio do
  // nada. Nesse caso a arte e o hero inteiro. Basta a dona escrever um titulo
  // no painel para o slide voltar a ser foto + bloco de texto.
  const standalone = banner.title === '' && banner.subtitle === '' && banner.buttonLabel === '';

  return (
    <div
      className={cx(styles.slide, standalone && styles.slideWide, active && styles.slideActive)}
      aria-roledescription="slide"
      aria-label={`${position + 1} de ${total}`}
      aria-hidden={!active}
    >
      <div className={cx(styles.media, standalone && styles.mediaWide)}>
        <BannerImage banner={banner} priority={position === 0} standalone={standalone} />

        {/* O texto passou a viver sobre a foto, e foto de produto nao tem
            compromisso de ser escura onde a frase cai. O veu garante o
            contraste sem escurecer a arte inteira: ele e opaco onde o texto
            esta e transparente no resto. */}
        {standalone ? null : <span className={styles.scrim} aria-hidden="true" />}
      </div>

      {standalone ? (
        // A home continua precisando de um `<h1>`: o titulo desenhado dentro
        // do arquivo nao chega a quem usa leitor de tela nem ao buscador. So
        // no primeiro slide, para nao repetir o cabecalho a cada banner.
        position === 0 ? <h1 className="visually-hidden">{storeName}</h1> : null
      ) : (
        <div className={cx(styles.panel, 'on-dark')}>
          {/* O `<h1>` da home. Os slides seguintes repetem a marcacao, mas so
              um deles esta visivel por vez. */}
          <h1 className={styles.title}>{banner.title}</h1>

          {banner.subtitle === '' ? null : <p className={styles.subtitle}>{banner.subtitle}</p>}

          {banner.buttonLabel === '' ? null : (
            <ButtonLink
              to={banner.link === '' ? ROUTES.products : banner.link}
              className={styles.action}
              tabIndex={active ? undefined : -1}
            >
              {banner.buttonLabel}
            </ButtonLink>
          )}
        </div>
      )}
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
function BannerImage({
  banner,
  priority,
  standalone,
}: {
  banner: PublicBanner;
  priority: boolean;
  standalone: boolean;
}) {
  const desktop = imageSrcSet(banner.imageDesktop);
  const mobile = banner.imageMobile === '' ? banner.imageDesktop : banner.imageMobile;

  return (
    <picture>
      {desktop ? (
        <source media="(min-width: 64rem)" srcSet={desktop} sizes={standalone ? '100vw' : '60vw'} />
      ) : null}

      <img
        {...imageProps(mobile, 'detail', '100vw')}
        alt=""
        className={cx(styles.image, standalone && styles.imageWide)}
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
    <section className={cx(styles.hero, styles.fallback, 'on-dark')} aria-label={storeName}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Perfumes e velas selecionados</h1>

        <p className={styles.subtitle}>
          Uma seleção curta, escolhida peca a peca. Veja o que esta disponível agora.
        </p>

        <ButtonLink to={ROUTES.products} className={styles.action}>
          Ver a vitrine
        </ButtonLink>
      </div>
    </section>
  );
}
