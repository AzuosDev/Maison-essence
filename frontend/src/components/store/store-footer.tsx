import { forwardRef, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container } from '@/components/ui';
import { useCategoryTree } from '@/features/catalog';
import { useStoreSettings } from '@/features/settings';
import { cx } from '@/lib/cx';
import { formatPhone } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { BrandLogo } from './brand-logo';
import { ChevronDownIcon, InstagramIcon, TiktokIcon } from './icons';
import { DeferredNewsletter } from './deferred-newsletter';
import { LEGAL } from './store.constants';
import { TrustBadges } from './trust-badges';
import styles from './store-footer.module.css';

/**
 * A largura em que as colunas do rodape passam a caber lado a lado. E a
 * mesma da folha de estilo, e precisa chegar ao JavaScript porque a diferenca
 * entre os dois tamanhos nao e so de aparencia: no celular cada coluna e um
 * botao que abre e fecha uma regiao, e no desktop e um titulo com a lista
 * sempre visivel. Sao duas arvores, nao duas aparencias.
 */
const COLUMNS = '(min-width: 40rem)';

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
  const collapsible = !useMediaQuery(COLUMNS);

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
          <FooterColumn title="Institucional" collapsible={collapsible}>
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
          </FooterColumn>

          <FooterColumn title="Categorias" collapsible={collapsible}>
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
          </FooterColumn>

          <FooterColumn title="Contato" collapsible={collapsible}>
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
          </FooterColumn>

          <FooterColumn title="Redes" collapsible={collapsible}>
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
          </FooterColumn>
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

interface FooterColumnProps {
  title: string;
  /** No celular a coluna e um acordeao; a partir de 40rem, uma coluna. */
  collapsible: boolean;
  children: ReactNode;
}

/**
 * Uma coluna do rodape — ou, no celular, uma fileira do acordeao.
 *
 * O botao e `aria-expanded` mais `aria-controls`, e nao um `<details>`. O
 * elemento nativo seria mais curto de escrever, mas ele guarda o proprio
 * estado no DOM: para manter as quatro sempre abertas no desktop seria
 * preciso ou sobrescrever a folha do navegador — que nas versoes recentes
 * esconde o conteudo por `content-visibility` num pseudo-elemento, e nao mais
 * por `display` num filho — ou escrever o atributo `open` de fora a cada
 * mudanca de largura. Os dois caminhos sao mais frageis do que nao montar o
 * botao quando ele nao serve.
 *
 * Todas nascem fechadas. Deixar uma aberta quebraria a fileira logo no
 * primeiro olhar, e o que ela guardaria — o WhatsApp — ja esta no botao
 * flutuante que acompanha a pagina inteira.
 */
function FooterColumn({ title, collapsible, children }: FooterColumnProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!collapsible) {
    return (
      <div className={styles.column}>
        <h2 className={styles.columnTitle}>{title}</h2>
        {children}
      </div>
    );
  }

  return (
    <div className={styles.column}>
      <h2 className={styles.columnHeading}>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((was) => !was);
          }}
        >
          {title}
          <ChevronDownIcon className={cx(styles.chevron, open && styles.chevronOpen)} />
        </button>
      </h2>

      {/* `hidden` em vez de nao renderizar: o `aria-controls` do botao precisa
          apontar para um elemento que exista mesmo com a regiao fechada. */}
      <div id={panelId} className={styles.panel} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
