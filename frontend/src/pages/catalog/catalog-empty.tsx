import { ROUTES } from '@/app/routes';
import { ProductGrid } from '@/components/store';
import { Button, ButtonLink, EmptyState } from '@/components/ui';
import { useShelf } from '@/features/catalog';
import styles from './catalog-empty.module.css';

/**
 * A tela de "nao achei nada".
 *
 * Desenhada, e nao um espaco em branco onde a grade estaria — e o terceiro
 * criterio de aceite desta pagina. Um grid vazio nao conta ao cliente se a
 * loja acabou, se a busca falhou ou se ele mesmo apertou um filtro demais.
 *
 * Tres coisas precisam estar aqui, e as tres tem a mesma finalidade: que a
 * visita nao termine nesta tela.
 *
 * 1. **O motivo**, em uma frase. "Nenhum produto com estes filtros" e
 *    diferente de "nenhum produto nesta categoria", e o texto vem de quem
 *    sabe qual e o caso — a pagina.
 * 2. **A saida imediata**: limpar os filtros. So aparece quando ha filtro
 *    para limpar; numa categoria genuinamente vazia o botao seria uma
 *    promessa falsa.
 * 3. **Produtos alternativos.** A prateleira de mais vendidos ja esta no
 *    cache de quem passou pela home, entao ela aparece de imediato e sem
 *    custo de rede. E a diferenca entre um beco sem saida e um desvio.
 */

export interface CatalogEmptyProps {
  title: string;
  description: string;
  /** Sem filtro aplicado, o botao de limpar nao faz sentido e nao aparece. */
  onClear?: (() => void) | undefined;
}

/** Quantos alternativos sugerir. Uma fileira, e nao uma segunda vitrine. */
const SUGGESTION_COUNT = 4;

export function CatalogEmpty({ title, description, onClear }: CatalogEmptyProps) {
  const { data, isPending } = useShelf('best-sellers', SUGGESTION_COUNT);
  const suggestions = data ?? [];

  return (
    <div className={styles.empty}>
      <EmptyState
        as="h2"
        title={title}
        description={description}
        actions={
          <>
            {onClear ? (
              <Button variant="primary" onClick={onClear}>
                Limpar filtros
              </Button>
            ) : null}

            <ButtonLink to={ROUTES.products} variant="secondary">
              Ver todos os produtos
            </ButtonLink>
          </>
        }
      />

      {/* A prateleira some quando nao ha o que sugerir — loja recem-montada,
          ou nenhum pedido ainda. Um "Talvez voce goste" seguido de nada
          seria pior que o vazio sozinho. */}
      {isPending || suggestions.length > 0 ? (
        <section className={styles.suggestions} aria-labelledby="catalogo-sugestoes">
          <h3 className={styles.suggestionsTitle} id="catalogo-sugestoes">
            Talvez você goste
          </h3>

          <ProductGrid
            products={suggestions}
            isLoading={isPending}
            skeletonCount={SUGGESTION_COUNT}
          />
        </section>
      ) : null}
    </div>
  );
}
