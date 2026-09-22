import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container } from '@/components/ui';
import { useCategoryTree } from '@/features/catalog';
import { useStoreSettings } from '@/features/settings';
import { formatPhone } from '@/lib/format';
import { BrandLogo } from './brand-logo';
import { InstagramIcon, TiktokIcon } from './icons';
import { DeferredNewsletter } from './deferred-newsletter';
import { LEGAL } from './store.constants';
import { TrustBadges } from './trust-badges';
import styles from './store-footer.module.css';

/**
 * O rodape da loja.
 *
 * Quatro colunas — institucional, categorias, contato e redes —, o cadastro
 * na newsletter, os selos de confianca e a linha legal. Tudo o que e da loja
 * vem da API: as paginas institucionais de `GET /pages`, as categorias de
 * `GET /categories` e contato e redes das configuracoes. O que nao existe
 * cadastrado simplesmente nao desenha, em vez de deixar um titulo de coluna
 * com o vazio embaixo.
 *
 * Encaminha `ref` porque o botao flutuante do WhatsApp precisa observar
 * quando este elemento entra na tela para sair da frente dele.
 */
export const StoreFooter = forwardRef<HTMLElement>(function StoreFooter(_props, ref) {
  const { settings, pages } = useStoreSettings();
  const { data: categories } = useCategoryTree();

  const year = new Date().getFullYear();
  const storeName = settings?.storeName || 'Maison Essence';

  return (
    <footer ref={ref} className={styles.footer}>
      <Container>
        <div className={styles.newsletter}>
          <BrandLogo inverted asLink={false} className={styles.newsletterBrand} />
          <DeferredNewsletter />
        </div>

        <TrustBadges />

        <div className={styles.columns}>
          <div className={styles.column}>
            <h2 className={styles.columnTitle}>Institucional</h2>

            <ul className={styles.list}>
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link to={ROUTES.page(page.slug)} className={styles.link}>
                    {page.title}
                  </Link>
                </li>
              ))}

              <li>
                <Link to={ROUTES.account.root} className={styles.link}>
                  Minha conta
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.column}>
            <h2 className={styles.columnTitle}>Categorias</h2>

            <ul className={styles.list}>
              {(categories ?? []).slice(0, 5).map((category) => (
                <li key={category.id}>
                  <Link to={ROUTES.category(category.slug)} className={styles.link}>
                    {category.name}
                  </Link>
                </li>
              ))}

              <li>
                <Link to={ROUTES.products} className={styles.link}>
                  Ver todos
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.column}>
            <h2 className={styles.columnTitle}>Contato</h2>

            <ul className={styles.list}>
              {settings?.whatsappNumber ? (
                <li>
                  <a href={settings.whatsappLink} className={styles.link}>
                    <span className={styles.strong}>
                      {formatPhone(settings.whatsappNumber.replace(/^55/, ''))}
                    </span>
                    Fale no WhatsApp
                  </a>
                </li>
              ) : null}

              {settings?.contactEmail ? (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className={styles.link}>
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}

              {settings?.businessHours ? (
                <li className={styles.text}>{settings.businessHours}</li>
              ) : null}

              {settings?.pickupEnabled && settings.pickupAddress ? (
                <li className={styles.text}>
                  Retirada em {settings.pickupAddress.city}/{settings.pickupAddress.state}
                </li>
              ) : null}
            </ul>
          </div>

          <div className={styles.column}>
            <h2 className={styles.columnTitle}>Redes</h2>

            <p className={styles.text}>Novidades, lancamentos e os bastidores da loja.</p>

            <div className={styles.social}>
              {settings?.socialLinks.instagram ? (
                <a
                  href={settings.socialLinks.instagram}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.socialLink}
                  aria-label="Instagram da loja"
                >
                  <InstagramIcon />
                </a>
              ) : null}

              {settings?.socialLinks.tiktok ? (
                <a
                  href={settings.socialLinks.tiktok}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={styles.socialLink}
                  aria-label="TikTok da loja"
                >
                  <TiktokIcon />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.legal}>
          {/* A linha do CNPJ so aparece quando ha um numero de verdade. Ver
              a explicacao em `store.constants.ts`. */}
          <p>{LEGAL.cnpj ? `${LEGAL.companyName} · CNPJ ${LEGAL.cnpj}` : storeName}</p>

          <p>
            © {year} {storeName}. Todos os direitos reservados.
          </p>
        </div>
      </Container>
    </footer>
  );
});
