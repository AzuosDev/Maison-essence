import { Link } from 'react-router-dom';
import { Container } from '@/components/ui';
import { ROUTES } from '@/app/routes';
import styles from './store-chrome.module.css';

/**
 * O cabecalho da loja.
 *
 * Moldura, por enquanto: a marca e o lugar reservado para busca, conta e
 * sacola. Vive em `components/store`, e nao dentro do layout, porque a area
 * da conta do cliente usa o mesmo cabecalho — para quem esta comprando, "meus
 * pedidos" e uma pagina da loja, nao outro site.
 */
export function StoreHeader() {
  return (
    <header className={styles.header}>
      <Container className={styles.bar}>
        <Link to={ROUTES.home} className={styles.brand} aria-label="Maison Essence, pagina inicial">
          Maison Essence
          <span className={styles.brandRule} aria-hidden="true" />
        </Link>

        {/* Busca, conta e sacola entram aqui. */}
        <div className={styles.actions} />
      </Container>
    </header>
  );
}
