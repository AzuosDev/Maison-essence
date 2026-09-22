import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container } from '@/components/ui';
import { cx } from '@/lib/cx';
import { BrandLogo } from './brand-logo';
import { CartButton } from './cart-button';
import { CategoriesPanel } from './categories-panel';
import { MainNav } from './main-nav';
import { MenuIcon, SearchIcon, UserIcon } from './icons';
import { MobileMenu } from './mobile-menu';
import { SearchOverlay } from './search-overlay';
import { useScrolled } from './use-scrolled';
import iconStyles from './icon-button.module.css';
import styles from './store-header.module.css';

/**
 * O cabecalho da loja.
 *
 * Fica fixo ao rolar e encolhe — a altura cai, o logo passa de empilhado
 * para em linha e a fila do menu se recolhe. Quem decide isso e o
 * `useScrolled`, que devolve um booleano em vez da posicao do scroll: o
 * componente so renderiza nas duas travessias do limiar, e nao a cada pixel.
 *
 * Tres coisas abrem daqui — o painel de categorias, a busca e a gaveta do
 * celular — e as tres sao estado deste componente. O painel mora aqui, e nao
 * dentro do `MainNav`, porque precisa da largura da tela inteira: como filho
 * do `<header>`, que e o elemento posicionado, ele se estica de ponta a
 * ponta; dentro do container de 1280px, ficaria preso a ele.
 *
 * Vive em `components/store`, e nao no layout, porque a area da conta do
 * cliente usa o mesmo cabecalho: para quem esta comprando, "meus pedidos" e
 * uma pagina da loja, nao outro site.
 */
export function StoreHeader() {
  const scrolled = useScrolled();
  const location = useLocation();
  const panelId = useId();

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);

  // Navegou: o painel fecha. Sem isto, clicar numa categoria trocaria a
  // pagina por tras de um painel que continua aberto por cima dela — e o
  // botao "voltar" do navegador faria o mesmo.
  //
  // O ajuste acontece durante o render, comparando com o caminho anterior, e
  // nao num efeito. E o padrao que o React documenta para estado que precisa
  // acompanhar uma mudanca de valor: o efeito so renderizaria de novo depois
  // de o painel ja ter aparecido por um quadro sobre a pagina nova.
  const [lastPath, setLastPath] = useState(location.pathname);

  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setCategoriesOpen(false);
  }

  // O painel nao e um dialogo e nao prende o foco, entao o Escape e o clique
  // fora precisam ser tratados aqui. Os dois so escutam enquanto ele esta
  // aberto — um listener permanente no documento para um painel que passa a
  // maior parte do tempo fechado e desperdicio.
  useEffect(() => {
    if (!categoriesOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setCategoriesOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setCategoriesOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [categoriesOpen]);

  return (
    <>
      <header ref={headerRef} className={cx(styles.header, scrolled && styles.scrolled)}>
        <Container className={styles.bar}>
          <div className={styles.left}>
            <button
              type="button"
              className={cx(iconStyles.button, styles.menuButton)}
              onClick={() => {
                setMenuOpen(true);
              }}
              aria-label="Abrir o menu"
            >
              <MenuIcon />
            </button>
          </div>

          <BrandLogo compact={scrolled} />

          <div className={styles.right}>
            <button
              type="button"
              className={iconStyles.button}
              onClick={() => {
                setSearchOpen(true);
              }}
              aria-label="Buscar produtos"
            >
              <SearchIcon />
            </button>

            <Link
              to={ROUTES.account.root}
              className={cx(iconStyles.button, styles.accountLink)}
              aria-label="Minha conta"
            >
              <UserIcon />
            </Link>

            <CartButton />
          </div>
        </Container>

        <div className={styles.navRow}>
          <MainNav
            categoriesOpen={categoriesOpen}
            panelId={panelId}
            onToggleCategories={() => {
              setCategoriesOpen((open) => !open);
            }}
          />
        </div>

        {categoriesOpen ? (
          <CategoriesPanel
            id={panelId}
            onNavigate={() => {
              setCategoriesOpen(false);
            }}
          />
        ) : null}
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
        }}
        onOpenSearch={() => {
          setSearchOpen(true);
        }}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
        }}
      />
    </>
  );
}
