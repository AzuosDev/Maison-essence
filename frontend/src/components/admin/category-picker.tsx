import { Checkbox } from '@/components/ui';
import type { AdminCategoryNode } from '@/features/admin';
import styles from './category-picker.module.css';

/**
 * Onde o produto aparece na loja.
 *
 * ## Por que caixas de marcar, e nao um `<select multiple>`
 *
 * O `<select multiple>` nativo exige Ctrl+clique para escolher o segundo
 * item e desmarca tudo com um clique distraido — em celular ele vira uma
 * lista de rolagem minuscula. Um produto entra em uma ou duas categorias, e
 * o que se quer e **ver** quais estao marcadas sem abrir nada.
 *
 * ## O pai nao marca os filhos
 *
 * Marcar "Masculino" nao marca "Amadeirado" embaixo dele, e e de proposito:
 * no dominio, categoria pai e uma categoria como as outras, e um produto
 * pode estar so nela. A contagem da vitrine ja soma os filhos no pai, entao
 * marcar os dois nao acrescenta alcance nenhum — so duplica o produto nas
 * contas.
 *
 * O que a tela faz e mostrar a relacao: o filho entra recuado, debaixo do
 * pai, com um filete ligando os dois.
 *
 * ## A categoria desativada continua aparecendo
 *
 * Marcada em cinza, com a palavra escrita. Esconde-la faria o produto perder
 * silenciosamente uma categoria que ele ja tem ao ser salvo — a tela manda o
 * array inteiro, e o que nao esta na tela nao esta no array.
 */

export interface CategoryPickerProps {
  tree: readonly AdminCategoryNode[];
  /** Os ids escolhidos. A ordem nao importa para a API. */
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
        busca, mas nao nos menus da loja.
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
