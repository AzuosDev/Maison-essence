import { useStoreSettings } from '@/features/settings';
import { BannerCarousel } from './banner-carousel';
import styles from './home-banner.module.css';

/**
 * A faixa de banner do meio da home.
 *
 * Mesma arte, mesma medida e mesmo carrossel do topo — ver
 * `banner-carousel.tsx`. O que muda e a vaga: esta corta a página depois da
 * última fileira de produto, onde antes ficava uma quarta prateleira que
 * quase nunca tinha o que mostrar. Quem decide o que entra aqui e a dona, no
 * painel, pelo campo "Onde aparece" de cada banner.
 *
 * ## Sem esqueleto, de propósito
 *
 * O hero reserva a altura dele enquanto `GET /settings` não responde, porque
 * ele esta na primeira tela e o salto seria visível. Aqui não: a faixa e
 * opcional — loja sem banner do meio e o caso comum —, e um esqueleto
 * reservando espaço para uma seção que pode não existir deixaria uma tarja
 * cinza permanente no meio da home de quem nunca cadastrou um. A seção
 * aparece quando o dado chega, muito acima do ponto em que alguém já rolou.
 */
export function HomeBanner() {
  const { settings } = useStoreSettings();
  const banners = (settings?.banners ?? []).filter((banner) => banner.placement === 'middle');

  if (banners.length === 0) {
    return null;
  }

  return (
    <BannerCarousel
      banners={banners}
      label="Campanhas da loja"
      lead={false}
      storeName={settings?.storeName ?? 'Maison Essence'}
      className={styles.band}
    />
  );
}
