import { forwardRef, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container } from '@/components/ui';
import { useCategoryTree } from '@/features/catalog';
import { useStoreSettings } from '@/features/settings';
import { ThemeToggle } from '@/features/theme';
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
 * A largura em que as colunas do rodapé passam a caber lado a lado. E a
 * mesma da folha de estilo, e precisa chegar ao JavaScript porque a diferença
 * entre os dois tamanhos não e só de aparência: no celular cada coluna e um
 * botão que abre e fecha uma região, e no desktop e um título com a lista
 * sempre visível. São duas árvores, não duas aparências.
 */
const COLUMNS = '(min-width: 40rem)';

/**
 * O rodapé da loja.
 *
 * Quatro colunas — institucional, categorias, contato e redes —, o cadastro
 * na newsletter, os selos de confiança e a linha legal. Tudo o que e da loja
 * vem da API: as páginas institucionais de `GET /pages`, as categorias de
 * `GET /categories` e contato e redes das configurações. O que não existe
 * cadastrado simplesmente não desenha, em vez de deixar um título de coluna
 * com o vazio embaixo.
 *
 * Encaminha `ref` porque o botão flutuante do WhatsApp precisa observar
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
            <p className={styles.text}>Novidades, lançamentos e os bastidores da loja.</p>

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

        {/*
          A escolha de tema fica no rodape, e nao no cabecalho.

          E uma preferencia, nao uma acao de compra: o cabecalho tem busca,
          conta e sacola, e um quarto alvo ali disputaria espaco com a sacola
          numa tela de 390px. No rodape ela fica onde as preferencias se
          procuram, e na faixa legal — que ja e a zona utilitaria da pagina,
          fora do caminho de quem esta comprando.
        */}
        <div className={styles.legal}>
          {/* A linha do CNPJ so aparece quando ha um numero de verdade. Ver
              a explicacao em `store.constants.ts`. */}
          <p>{LEGAL.cnpj ? `${LEGAL.companyName} · CNPJ ${LEGAL.cnpj}` : storeName}</p>

          <p>
            © {year} {storeName}. Todos os direitos reservados.
          </p>

          <ThemeToggle className={styles.theme} />
        </div>
      </Container>
    </footer>
  );
});

interface FooterColumnProps {
  title: string;
  /** No celular a coluna e um acordeão; a partir de 40rem, uma coluna. */
  collapsible: boolean;
  children: ReactNode;
}

/**
 * Uma coluna do rodapé — ou, no celular, uma fileira do acordeão.
 *
 * O botão e `aria-expanded` mais `aria-controls`, e não um `<details>`. O
 * elemento nativo seria mais curto de escrever, mas ele guarda o próprio
 * estado no DOM: para manter as quatro sempre abertas no desktop seria
 * preciso ou sobrescrever a folha do navegador — que nas versões recentes
 * esconde o conteúdo por `content-visibility` num pseudo-elemento, e não mais
 * por `display` num filho — ou escrever o atributo `open` de fora a cada
 * mudanca de largura. Os dois caminhos são mais frageis do que não montar o
 * botão quando ele não serve.
 *
 * Todas nascem fechadas. Deixar uma aberta quebraria a fileira logo no
 * primeiro olhar, e o que ela guardaria — o WhatsApp — já esta no botão
 * flutuante que acompanha a página inteira.
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
