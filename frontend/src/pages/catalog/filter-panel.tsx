import { useId, useState } from 'react';
import { Button, Checkbox, Input, Skeleton } from '@/components/ui';
import type { CatalogContext, CatalogFacets, CatalogFilters } from '@/features/catalog';
import { cx } from '@/lib/cx';
import { foldAccents } from '@/lib/text';
import { PriceRange } from './price-range';
import styles from './filter-panel.module.css';

/**
 * A barra de filtros.
 *
 * O mesmo componente serve os dois lugares em que ela aparece: a coluna fixa
 * do desktop e a gaveta do celular. Nao ha duas versoes a manter em dia — a
 * diferenca entre uma e outra e a moldura em volta, e quem a desenha e a
 * pagina.
 *
 * ## Aplicar na hora, e nao num botao
 *
 * Cada marcacao aplica o filtro imediatamente. Um botao "aplicar" faria
 * sentido se cada mudanca custasse caro; aqui a lista ja esta em cache e a
 * resposta e imediata, entao o botao so acrescentaria um passo entre a
 * intencao e o resultado. A faixa de preco e a excecao parcial: aplica ao
 * soltar, porque durante o arrasto ainda nao ha intencao nenhuma.
 *
 * ## O que a rota impos nao aparece
 *
 * Em `/pronta-entrega`, a caixa "somente pronta entrega" fica de fora: o
 * filtro ja e o endereco da pagina, e uma caixa marcada que nao se pode
 * desmarcar e pior que caixa nenhuma.
 */

export interface FilterPanelProps {
  filters: CatalogFilters;
  context: CatalogContext;
  facets: CatalogFacets;
  onChange: (patch: Partial<CatalogFilters>) => void;
  onClear: () => void;
  /** Quantos filtros estao aplicados: decide se "limpar" aparece. */
  activeCount: number;
  className?: string | undefined;
}

export function FilterPanel({
  filters,
  context,
  facets,
  onChange,
  onClear,
  activeCount,
  className,
}: FilterPanelProps) {
  return (
    <div className={cx(styles.panel, className)}>
      <section className={styles.group}>
        <h3 className={styles.legend}>Faixa de preço</h3>

        {facets.isLoading ? (
          <Skeleton height="var(--control-height-small)" />
        ) : (
          <PriceRange
            minCents={filters.minCents}
            maxCents={filters.maxCents}
            ceilingCents={facets.ceilingCents}
            onCommit={(minCents, maxCents) => {
              onChange({ minCents, maxCents });
            }}
          />
        )}
      </section>

      <BrandFilter
        brands={facets.brands}
        isLoading={facets.isLoading}
        selected={filters.brand}
        onSelect={(brand) => {
          onChange({ brand });
        }}
      />

      <section className={styles.group}>
        <h3 className={styles.legend}>Disponibilidade</h3>

        <div className={styles.checks}>
          <Checkbox
            label="Somente em estoque"
            checked={filters.inStock}
            onChange={(event) => {
              onChange({ inStock: event.target.checked });
            }}
          />

          {context.readyToShip === true ? null : (
            <Checkbox
              label="Somente pronta entrega"
              checked={filters.readyToShip}
              onChange={(event) => {
                onChange({ readyToShip: event.target.checked });
              }}
            />
          )}

          <Checkbox
            label="Somente com desconto"
            // A vitrine ordena por maior desconto enquanto este filtro
            // estiver ligado — ver `apiParamsFrom`, que explica por que.
            hint={filters.onSale ? 'A lista fica ordenada por maior desconto.' : undefined}
            checked={filters.onSale}
            onChange={(event) => {
              onChange({ onSale: event.target.checked });
            }}
          />
        </div>
      </section>

      {activeCount > 0 ? (
        <Button variant="ghost" block onClick={onClear} className={styles.clear}>
          Limpar filtros ({activeCount})
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A marca, com busca dentro da propria lista.
 *
 * A busca interna existe porque a lista cresce com o catalogo: com trinta
 * marcas, rolar a coluna inteira para achar "Lattafa" e mais lento do que
 * digitar quatro letras. Abaixo de um punhado de marcas o campo seria ruido,
 * entao ele so aparece quando ha o que procurar.
 *
 * A comparacao ignora acento e caixa: quem digita "acqua" acha "Àcqua".
 *
 * Os itens sao botoes com `aria-pressed`, e nao radios. E uma escolha unica,
 * como um radio, mas a lista encolhe conforme se digita — e um grupo de
 * radios que perde opcoes enquanto a pessoa navega por ele com as setas
 * confunde mais do que ajuda.
 */
interface BrandFilterProps {
  brands: readonly string[];
  isLoading: boolean;
  selected: string;
  onSelect: (brand: string) => void;
}

/** A partir de quantas marcas vale a pena ter um campo de busca. */
const SEARCHABLE_FROM = 8;

function BrandFilter({ brands, isLoading, selected, onSelect }: BrandFilterProps) {
  const [term, setTerm] = useState('');
  const legendId = useId();

  if (isLoading) {
    return (
      <section className={styles.group}>
        <h3 className={styles.legend}>Marca</h3>
        <Skeleton height="6rem" />
      </section>
    );
  }

  if (brands.length === 0) {
    return null;
  }

  const needle = foldAccents(term.trim());
  const shown = needle === '' ? brands : brands.filter((b) => foldAccents(b).includes(needle));

  return (
    <section className={styles.group} aria-labelledby={legendId}>
      <h3 className={styles.legend} id={legendId}>
        Marca
      </h3>

      {brands.length >= SEARCHABLE_FROM ? (
        <Input
          type="search"
          label="Buscar marca"
          hideLabel
          placeholder="Buscar marca"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
          }}
          className={styles.brandSearch}
        />
      ) : null}

      <ul className={styles.brands}>
        <li>
          <button
            type="button"
            className={cx(styles.brand, selected === '' && styles.brandActive)}
            aria-pressed={selected === ''}
            onClick={() => {
              onSelect('');
            }}
          >
            Todas as marcas
          </button>
        </li>

        {shown.map((brand) => (
          <li key={brand}>
            <button
              type="button"
              className={cx(styles.brand, selected === brand && styles.brandActive)}
              aria-pressed={selected === brand}
              onClick={() => {
                // Clicar na marca ja escolhida desmarca. E o caminho de volta
                // sem precisar achar "Todas as marcas" no alto de uma lista
                // que pode estar rolada.
                onSelect(selected === brand ? '' : brand);
              }}
            >
              {brand}
            </button>
          </li>
        ))}
      </ul>

      {shown.length === 0 ? <p className={styles.noBrand}>Nenhuma marca com esse nome.</p> : null}
    </section>
  );
}
