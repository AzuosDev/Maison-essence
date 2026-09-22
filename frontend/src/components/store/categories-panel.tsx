import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container, Skeleton } from '@/components/ui';
import { useCategoryTree } from '@/features/catalog';
import styles from './categories-panel.module.css';

/**
 * O painel de categorias, em largura total sob o cabecalho.
 *
 * As categorias vem de `GET /categories`, ja em arvore de um nivel: cada
 * coluna e uma categoria pai, e as subcategorias vao listadas abaixo dela. O
 * que a dona cadastrar aparece aqui sem ninguem tocar no codigo — inclusive
 * a sexta coluna, porque o grid se acomoda sozinho.
 *
 * O painel e um bloco de links, e nao um dialogo: nao prende o foco. Quem
 * chega de teclado passa por ele com Tab na ordem natural, e o Escape — que
 * o cabecalho trata — fecha e devolve o foco ao botao "Categorias".
 */
interface CategoriesPanelProps {
  /** O id que o botao "Categorias" aponta em `aria-controls`. */
  id: string;
  /** Fecha o painel: todo link daqui navega e o painel precisa sumir. */
  onNavigate: () => void;
}

export function CategoriesPanel({ id, onNavigate }: CategoriesPanelProps) {
  const { data: categories, isLoading } = useCategoryTree();

  return (
    <div id={id} className={styles.panel}>
      <Container className={styles.inner}>
        {isLoading ? (
          <ul className={styles.columns}>
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className={styles.parent}>
                <Skeleton variant="title" style={{ maxWidth: '8rem' }} />
                <div style={{ marginTop: 'var(--space-16)' }}>
                  <Skeleton variant="text" style={{ maxWidth: '6rem' }} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && (!categories || categories.length === 0) ? (
          <p className={styles.empty}>Nenhuma categoria cadastrada ainda.</p>
        ) : null}

        {categories && categories.length > 0 ? (
          <ul className={styles.columns}>
            {categories.map((category) => (
              <li key={category.id} className={styles.parent}>
                <Link
                  to={ROUTES.category(category.slug)}
                  className={styles.parentLink}
                  onClick={onNavigate}
                >
                  {category.name}
                  <span className={styles.count}>{category.productCount}</span>
                </Link>

                {category.children.length > 0 ? (
                  <ul className={styles.children}>
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          to={ROUTES.category(child.slug)}
                          className={styles.childLink}
                          onClick={onNavigate}
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.footer}>
          <Link to={ROUTES.products} className={styles.allLink} onClick={onNavigate}>
            Ver todos os produtos
          </Link>
        </div>
      </Container>
    </div>
  );
}
