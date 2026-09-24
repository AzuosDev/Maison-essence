import { Checkbox } from '@/components/ui';
import type { AdminCategoryNode } from '@/features/admin';
import styles from './category-picker.module.css';

/**
 * Onde o produto aparece na loja.
 *
 * ## Por que caixas de marcar, e não um `<select multiple>`
 *
 * O `<select multiple>` nativo exige Ctrl+clique para escolher o segundo
 * item e desmarca tudo com um clique distraido — em celular ele vira uma
 * lista de rolagem minúscula. Um produto entra em uma ou duas categorias, e
 * o que se quer e **ver** quais estão marcadas sem abrir nada.
 *
 * ## O pai não marca os filhos
 *
 * Marcar "Masculino" não marca "Amadeirado" embaixo dele, e e de propósito:
 * no domínio, categoria pai e uma categoria como as outras, e um produto
 * pode estar só nela. A contagem da vitrine já soma os filhos no pai, então
 * marcar os dois não acrescenta alcance nenhum — só duplica o produto nas
 * contas.
 *
 * O que a tela faz e mostrar a relação: o filho entra recuado, debaixo do
 * pai, com um filete ligando os dois.
 *
 * ## A categoria desativada continua aparecendo
 *
 * Marcada em cinza, com a palavra escrita. Esconde-lá faria o produto perder
 * silenciosamente uma categoria que ele já tem ao ser salvo — a tela manda o
 * array inteiro, e o que não esta na tela não esta no array.
 */

export interface CategoryPickerProps {
  tree: readonly AdminCategoryNode[];
  /** Os ids escolhidos. A ordem não importa para a API. */
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function CategoryPicker({ tree, selected, onChange, disabled }: CategoryPickerProps) {
  const chosen = new Set(selected);

  const toggle = (id: string): void => {
    const next = new Set(chosen);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    onChange([...next]);
  };

  if (tree.length === 0) {
    return (
      <p className={styles.empty}>
        Nenhuma categoria cadastrada ainda. O produto pode ser salvo sem categoria — ele aparece na
        busca, mas não nos menus da loja.
      </p>
    );
  }

  return (
    <ul className={styles.tree}>
      {tree.map((parent) => (
        <li key={parent.id}>
          <Line
            id={parent.id}
            name={parent.name}
            isActive={parent.isActive}
            productCount={parent.productCount}
            checked={chosen.has(parent.id)}
            disabled={disabled}
            onToggle={toggle}
          />

          {parent.children.length === 0 ? null : (
            <ul className={styles.children}>
              {parent.children.map((child) => (
                <li key={child.id}>
                  <Line
                    id={child.id}
                    name={child.name}
                    isActive={child.isActive}
                    productCount={child.productCount}
                    checked={chosen.has(child.id)}
                    disabled={disabled}
                    onToggle={toggle}
                  />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function Line({
  id,
  name,
  isActive,
  productCount,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  name: string;
  isActive: boolean;
  productCount: number;
  checked: boolean;
  disabled: boolean | undefined;
  onToggle: (id: string) => void;
}) {
  return (
    <div className={styles.line}>
      <Checkbox
        label={name}
        checked={checked}
        disabled={disabled}
        className={styles.checkbox}
        onChange={() => {
          onToggle(id);
        }}
      />

      {/*
        A contagem e a marca de desativada ficam fora do `<label>`: dentro
        dela, o leitor de tela leria "Masculino 12 desativada" como se fosse o
        nome da categoria.
      */}
      <span className={styles.count} aria-hidden="true">
        {productCount}
      </span>

      {isActive ? null : <span className={styles.off}>fora do ar</span>}
    </div>
  );
}
