import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Accordion, AccordionItem, Drawer, Skeleton } from '@/components/ui';
import { useCategoryTree } from '@/features/catalog';
import { useStoreSettings } from '@/features/settings';
import { ThemeToggle } from '@/features/theme';
import { InstagramIcon, SearchIcon, TiktokIcon } from './icons';
import styles from './mobile-menu.module.css';

/**
 * O menu do celular.
 *
 * A gaveta vem do design system, então o foco preso, o Escape e a devolução
 * do foco ao hamburguer já vem prontos. O que muda e o conteúdo: busca em
 * cima, categorias em acordeão no meio, institucional embaixo.
 *
 * A árvore usa o `Accordion` — o mesmo componente da página de perguntas
 * frequentes — e por isso as setas do teclado navegam entre as categorias
 * sem nenhuma linha a mais aqui.
 */
interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  /** Fecha a gaveta e abre a busca em tela cheia. */
  onOpenSearch: () => void;
}

export function MobileMenu({ open, onClose, onOpenSearch }: MobileMenuProps) {
  const { data: categories, isLoading } = useCategoryTree();
  const { settings, pages } = useStoreSettings();

  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left">
      <div className={styles.content}>
        <button
          type="button"
          className={styles.search}
          onClick={() => {
            onClose();
            onOpenSearch();
          }}
        >
          <SearchIcon width="18" height="18" />
          Buscar perfumes, marcas...
        </button>

        <ul className={styles.links}>
          <li>
            <Link to={ROUTES.home} className={styles.link} onClick={onClose}>
              Início
            </Link>
          </li>
          <li>
            <Link to={ROUTES.products} className={styles.link} onClick={onClose}>
              Produtos
            </Link>
          </li>
          <li>
            <Link to={ROUTES.readyToShip} className={styles.link} onClick={onClose}>
              Pronta Entrega
            </Link>
          </li>
        </ul>

        <div>
          <p className={styles.sectionTitle}>Categorias</p>

          {isLoading ? <Skeleton variant="text" /> : null}

          {!isLoading && (!categories || categories.length === 0) ? (
            <p className={styles.empty}>Nenhuma categoria cadastrada ainda.</p>
          ) : null}

          {categories && categories.length > 0 ? (
            <Accordion>
              {categories.map((category) => (
                <AccordionItem
                  key={category.id}
                  value={category.slug}
                  title={category.name}
                  as="h3"
                >
                  <ul className={styles.subList}>
                    <li>
                      <Link
                        to={ROUTES.category(category.slug)}
                        className={`${styles.subLink} ${styles.allInCategory}`}
                        onClick={onClose}
                      >
                        Ver tudo em {category.name}
                      </Link>
                    </li>

                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          to={ROUTES.category(child.slug)}
                          className={styles.subLink}
                          onClick={onClose}
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}
        </div>

        <div className={styles.footer}>
          <p className={styles.sectionTitle}>Institucional</p>

          <ul className={styles.institutional}>
            {pages.map((institutional) => (
              <li key={institutional.slug}>
                <Link
                  to={ROUTES.page(institutional.slug)}
                  className={styles.institutionalLink}
                  onClick={onClose}
                >
                  {institutional.title}
                </Link>
              </li>
            ))}

            <li>
              <Link to={ROUTES.account.root} className={styles.institutionalLink} onClick={onClose}>
                Minha conta
              </Link>
            </li>
          </ul>

          {settings?.socialLinks.instagram || settings?.socialLinks.tiktok ? (
            <div className={styles.social}>
              {settings.socialLinks.instagram ? (
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

              {settings.socialLinks.tiktok ? (
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
          ) : null}

          {/*
            O tema, aqui e no rodapé.

            Na barra do celular não cabe: depois da assinatura há largura para
            dois alvos, e são a busca e a sacola. A gaveta e o lugar natural
            do que sai de lá — e onde a conta já estava. Em segmentos, e não
            no botão que alterna do cabeçalho: quem abre a gaveta esta
            procurando, não repetindo um toque que já conhece.
          */}
          <ThemeToggle tone="page" className={styles.theme} />
        </div>
      </div>
    </Drawer>
  );
}
