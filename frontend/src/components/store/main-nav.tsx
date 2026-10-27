import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useStoreSettings } from '@/features/settings';
import { cx } from '@/lib/cx';
import { ChevronDownIcon } from './icons';
import styles from './main-nav.module.css';

/**
 * O menu da faixa preta: Categorias, Produtos, Pronta Entrega e as páginas
 * institucionais.
 *
 * "Categorias" abre o painel e por isso e um `<button>`, não um link: chamar
 * de link uma coisa que não navega faria o teclado e o leitor de tela
 * prometerem uma viagem que não acontece. Os outros são `NavLink`, que marca
 * sozinho o item da página atual — e marca em `aria-current="page"`, não só
 * no filete dourado.
 *
 * ## Por que as institucionais estão aqui, e não só no rodapé
 *
 * Metade de quem chega nesta loja nunca ouviu falar dela. "Trocas e
 * devoluções", "Como comprar" e "Quem somos" são as três perguntas que essa
 * pessoa faz antes de considerar pagar — e deixa-las só no rodapé significa
 * pedir que ela role a loja inteira para encontrar a resposta.
 *
 * Elas vem de `GET /pages`, pelo contexto que a moldura já busca: a dona
 * publica uma página nova no painel e ela entra no menu sozinha. A lista não
 * tem teto: são cinco endereços fixos (ver `INSTITUTIONAL_PAGE_SLUGS`), e com
 * as quatro primeiras a faixa ainda não enche numa tela de 1024px.
 */
interface MainNavProps {
  /** O painel de categorias esta aberto? */
  categoriesOpen: boolean;
  onToggleCategories: () => void;
  /** O id do painel, para o `aria-controls` do botão. */
  panelId: string;
}

export function MainNav({ categoriesOpen, onToggleCategories, panelId }: MainNavProps) {
  const { pages } = useStoreSettings();

  return (
    <nav className={styles.nav} aria-label="Menu principal">
      <ul className={styles.list}>
        <li className={styles.item}>
          <button
            type="button"
            onClick={onToggleCategories}
            aria-expanded={categoriesOpen}
            aria-controls={panelId}
            className={cx(styles.link, styles.categories, categoriesOpen && styles.open)}
          >
            Categorias
            <ChevronDownIcon className={styles.chevron} width="14" height="14" />
          </button>
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
          <NavLink
            to={ROUTES.readyToShip}
            className={({ isActive }) => cx(styles.link, isActive && styles.active)}
          >
            Pronta Entrega
          </NavLink>
        </li>

        {pages.map((page) => (
          <li key={page.slug} className={cx(styles.item, styles.institutional)}>
            <NavLink
              to={ROUTES.page(page.slug)}
              className={({ isActive }) => cx(styles.link, isActive && styles.active)}
            >
              {page.title}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
