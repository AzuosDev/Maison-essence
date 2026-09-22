import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { cx } from '@/lib/cx';
import { ChevronDownIcon } from './icons';
import styles from './main-nav.module.css';

/**
 * O menu do cabecalho: Inicio, Produtos, Categorias e Pronta Entrega.
 *
 * Tres deles sao `NavLink`, que marca sozinho o item da pagina atual — e
 * marca em `aria-current="page"`, nao so na cor. "Categorias" e um
 * `<button>`, porque nao leva a lugar nenhum: abre o painel. Chamar isso de
 * link faria o teclado e o leitor de tela prometerem uma navegacao que nao
 * acontece.
 */
interface MainNavProps {
  /** O painel de categorias esta aberto? */
  categoriesOpen: boolean;
  onToggleCategories: () => void;
  /** O id do painel, para o `aria-controls` do botao. */
  panelId: string;
}

export function MainNav({ categoriesOpen, onToggleCategories, panelId }: MainNavProps) {
  return (
    <nav className={styles.nav} aria-label="Menu principal">
      <ul className={styles.list}>
        <li className={styles.item}>
          <NavLink
            to={ROUTES.home}
            end
            className={({ isActive }) => cx(styles.link, isActive && styles.active)}
          >
            Inicio
          </NavLink>
        </li>

        <li className={styles.item}>
          <NavLink
            to={ROUTES.products}
            className={({ isActive }) => cx(styles.link, isActive && styles.active)}
          >
            Produtos
          </NavLink>
        </li>

        <li className={styles.item}>
          <button
            type="button"
            onClick={onToggleCategories}
            aria-expanded={categoriesOpen}
            aria-controls={panelId}
            className={cx(styles.link, categoriesOpen && styles.open)}
          >
            Categorias
            <ChevronDownIcon className={styles.chevron} width="14" height="14" />
          </button>
        </li>

        <li className={styles.item}>
          <NavLink
            to={ROUTES.readyToShip}
            className={({ isActive }) => cx(styles.link, isActive && styles.active)}
          >
            Pronta Entrega
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
