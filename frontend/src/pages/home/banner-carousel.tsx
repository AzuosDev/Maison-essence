import { ROUTES } from '@/app/routes';
import { ButtonLink } from '@/components/ui';
import { ChevronRightIcon } from '@/components/store/icons';
import { type PublicBanner } from '@/features/settings';
import { imageProps, imageSrcSet } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { useCarousel } from './use-carousel';
import styles from './banner-carousel.module.css';

/**
 * O carrossel de banners da home, em qualquer uma das duas vagas.
 *
 * A home tem duas: o topo, acima das categorias, e a faixa do meio, depois da
 * última fileira de produto. As duas desenham a mesma coisa — e de propósito.
 * A dona prepara uma arte só, na mesma medida, e decide no painel onde ela
 * entra; um segundo desenho de banner, mais baixo ou mais estreito, obrigaria
 * a preparar duas artes para a mesma campanha.
 *
 * O que muda entre as vagas esta todo no `lead` — ver a prop.
 *
 * ## As duas fotos
 *
 * Desktop e celular são arquivos diferentes, escolhidos por `<picture>` com
 * `media`. O celular baixa a versão retrato e nunca vê a panorâmica de
 * 1200px.
 */
export interface BannerCarouselProps {
  /** Já filtrados pelo agendamento e pela vaga. Nunca vazio. */
  banners: readonly PublicBanner[];
  /** O rótulo do carrossel para quem navega por marcos. */
  label: string;
  /**
   * Este carrossel abre a página.
   *
   * Decide três coisas de uma vez porque as três são a mesma: o título do
   * slide e o `<h1>` da home, a primeira arte sai com prioridade por ser o
   * LCP, e o banner que já traz o título desenhado dentro da arte empresta o
   * nome da loja a um `<h1>` invisível. Fora do topo nada disso vale — um
   * segundo `<h1>` parte o documento em dois, e prioridade em tudo e
   * prioridade em nenhum.
   */
  lead: boolean;
  /** Vira o `<h1>` invisível do banner de arte inteira, só no topo. */
  storeName: string;
  className?: string | undefined;
}

export function BannerCarousel({
  banners,
  label,
  lead,
  storeName,
  className,
}: BannerCarouselProps) {
  const carousel = useCarousel(banners.length);

  return (
    // O carrossel inteiro e a área que pausa e que ouve as setas, e não um
    // controle dentro dele: o cliente passa o mouse sobre a foto, não sobre o
    // indicador. O equivalente para quem não usa mouse esta coberto — os
    // indicadores são botões de verdade, e as setas chegam aqui por
    // borbulhamento quando o foco esta em um deles.
    // oxlint-disable-next-line no-noninteractive-element-interactions
    <section
      className={cx(styles.carousel, className)}
      aria-roledescription="carrossel"
      aria-label={label}
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
        // Enquanto gira sozinho, a troca não e anunciada: o leitor de tela
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
            lead={lead}
            storeName={storeName}
          />
        ))}
      </div>

      {/* As setas são a forma que quase todo mundo já tenta primeiro num
          banner que gira, e elas ficam só onde há mouse: no toque, quem manda
          e o arrasto e os indicadores, e duas setas sobre a foto comeriam o
          canto da arte numa tela de 390px. */}
      {banners.length > 1 ? (
        <>
          <button
            type="button"
            className={cx(styles.arrow, styles.arrowPrevious)}
            onClick={carousel.previous}
            aria-label={`${label}: banner anterior`}
          >
            <ChevronRightIcon width="18" height="18" />
          </button>

          <button
            type="button"
            className={cx(styles.arrow, styles.arrowNext)}
            onClick={carousel.next}
            aria-label={`${label}: próximo banner`}
          >
            <ChevronRightIcon width="18" height="18" />
          </button>
        </>
      ) : null}

      {/* Sem rótulo de grupo em volta dos indicadores: cada botão já diz
          "Banner 2 de 3", que e a informação inteira. Um `role="group"` só
          acrescentaria mais um nível para quem navega por marcos. */}
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
              aria-label={`${label}: banner ${String(position + 1)} de ${String(banners.length)}`}
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
  lead: boolean;
  storeName: string;
}

/**
 * Um banner do carrossel.
 *
 * O slide inativo esta com `visibility: hidden`, e por isso os links dele já
 * saem da ordem do Tab sozinhos. O `aria-hidden` completa o par para quem não
 * enxerga o que esta escondido, e o `tabIndex` do botão fecha a brecha do
 * navegador que ignorar a visibilidade.
 */
function Slide({ banner, position, total, active, lead, storeName }: SlideProps) {
  // Banner que já traz logo, frase e botão desenhados dentro da própria arte
  // chega aqui sem texto nenhum cadastrado. Dar a ele a grade de duas colunas
  // deixaria metade do hero preta e vazia, com o rótulo solto no meio do
  // nada. Nesse caso a arte e o hero inteiro. Basta a dona escrever um título
  // no painel para o slide voltar a ser foto + bloco de texto.
  const standalone = banner.title === '' && banner.subtitle === '' && banner.buttonLabel === '';

  // O `<h1>` da home e do carrossel que abre a página. Na faixa do meio o
  // título do banner e um `h2`, no mesmo nível dos títulos de prateleira.
  const Heading = lead ? 'h1' : 'h2';

  return (
    <div
      className={cx(styles.slide, standalone && styles.slideWide, active && styles.slideActive)}
      aria-roledescription="slide"
      aria-label={`${String(position + 1)} de ${String(total)}`}
      aria-hidden={!active}
    >
      <div className={cx(styles.media, standalone && styles.mediaWide)}>
        <BannerImage banner={banner} priority={lead && position === 0} standalone={standalone} />

        {/* O texto passou a viver sobre a foto, e foto de produto nao tem
            compromisso de ser escura onde a frase cai. O veu garante o
            contraste sem escurecer a arte inteira: ele e opaco onde o texto
            esta e transparente no resto. */}
        {standalone ? null : <span className={styles.scrim} aria-hidden="true" />}
      </div>

      {standalone ? (
        // A home continua precisando de um `<h1>`: o título desenhado dentro
        // do arquivo não chega a quem usa leitor de tela nem ao buscador. Só
        // no primeiro slide do carrossel de cima, para não repetir o
        // cabeçalho a cada banner nem abrir um segundo `h1` no meio da
        // página.
        lead && position === 0 ? <h1 className="visually-hidden">{storeName}</h1> : null
      ) : (
        <div className={cx(styles.panel, 'on-dark')}>
          {/* Os slides seguintes repetem a marcacao, mas so um deles esta
              visivel por vez. */}
          <Heading className={styles.title}>{banner.title}</Heading>

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
 * `alt=""` de propósito: o título e o subtítulo do banner estão no DOM, ao
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
