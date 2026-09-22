import { ROUTES } from '@/app/routes';
import { ChipLink } from '@/components/ui';
import type { PublicCategory } from '@/features/catalog';
import styles from './subcategory-chips.module.css';

/**
 * As pilulas de subcategoria, logo abaixo do cabecalho.
 *
 * Sao `ChipLink` e nao `Chip`: cada subcategoria e um endereco proprio, que
 * precisa ser compartilhavel no WhatsApp e indexavel pelo Google. Um botao
 * que trocasse o filtro sem mudar a URL faria "Amadeirados masculinos"
 * chegar ao contato como o link generico da categoria pai.
 *
 * A pilula ativa e a preta — `active` no `ChipLink` —, e o estado tambem vai
 * em `aria-current="page"`, para que "Masculino, pagina atual" seja o que o
 * leitor de tela anuncia.
 *
 * ## A primeira pilula
 *
 * "Tudo em X" volta para a categoria pai e e a unica forma de sair de uma
 * subcategoria sem usar o botao de voltar do navegador. Fica ativa quando
 * nenhuma subcategoria esta escolhida.
 *
 * A faixa rola na horizontal no celular e sangra ate a borda da tela: uma
 * pilula cortada pela metade no canto direito e o que conta ao cliente que
 * ha mais para o lado. Com as pilulas terminando certinho na margem, a
 * faixa parece completa e ninguem arrasta.
 */

export interface SubcategoryChipsProps {
  /** A categoria pai, para o "Tudo em X". */
  parent: PublicCategory;
  /** As subcategorias. Chamadas `items` e nao `children` de proposito: o
   * nome reservado do JSX confundiria a leitura de quem as passa. */
  items: readonly PublicCategory[];
  /** O slug em exibicao. Igual ao do pai quando nenhuma filha esta escolhida. */
  activeSlug: string;
}

export function SubcategoryChips({ parent, items, activeSlug }: SubcategoryChipsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={styles.strip} aria-label="Subcategorias">
      <ul className={styles.list}>
        <li>
          <ChipLink
            to={ROUTES.category(parent.slug)}
            active={activeSlug === parent.slug}
            className={styles.chip}
          >
            Tudo em {parent.name}
          </ChipLink>
        </li>

        {items.map((child) => (
          <li key={child.id}>
            <ChipLink
              to={ROUTES.category(child.slug)}
              active={activeSlug === child.slug}
              count={child.productCount}
              className={styles.chip}
            >
              {child.name}
            </ChipLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
