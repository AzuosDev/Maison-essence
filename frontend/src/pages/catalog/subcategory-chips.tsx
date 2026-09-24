import { ROUTES } from '@/app/routes';
import { ChipLink } from '@/components/ui';
import type { PublicCategory } from '@/features/catalog';
import styles from './subcategory-chips.module.css';

/**
 * As pílulas de subcategoria, logo abaixo do cabeçalho.
 *
 * São `ChipLink` e não `Chip`: cada subcategoria e um endereço próprio, que
 * precisa ser compartilhável no WhatsApp e indexável pelo Google. Um botão
 * que trocasse o filtro sem mudar a URL faria "Amadeirados masculinos"
 * chegar ao contato como o link genérico da categoria pai.
 *
 * A pílula ativa e a preta — `active` no `ChipLink` —, e o estado também vai
 * em `aria-current="page"`, para que "Masculino, página atual" seja o que o
 * leitor de tela anuncia.
 *
 * ## A primeira pílula
 *
 * "Tudo em X" volta para a categoria pai e e a única forma de sair de uma
 * subcategoria sem usar o botão de voltar do navegador. Fica ativa quando
 * nenhuma subcategoria esta escolhida.
 *
 * A faixa rola na horizontal no celular e sangra até a borda da tela: uma
 * pílula cortada pela metade no canto direito e o que conta ao cliente que
 * há mais para o lado. Com as pílulas terminando certinho na margem, a
 * faixa parece completa e ninguém arrasta.
 */

export interface SubcategoryChipsProps {
  /** A categoria pai, para o "Tudo em X". */
  parent: PublicCategory;
  /** As subcategorias. Chamadas `items` e não `children` de propósito: o
   * nome reservado do JSX confundiria a leitura de quem as passa. */
  items: readonly PublicCategory[];
  /** O slug em exibição. Igual ao do pai quando nenhuma filha esta escolhida. */
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
