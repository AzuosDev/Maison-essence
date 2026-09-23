import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Badge, Switch } from '@/components/ui';
import {
  CATEGORY_LIMITS,
  moveChild,
  moveParent,
  type AdminCategory,
  type AdminCategoryNode,
} from '@/features/admin';
import { cx } from '@/lib/cx';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from './admin-icons';
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './category-tree.module.css';

/**
 * O menu da loja, do jeito que a dona o reorganiza.
 *
 * ## Esta tela e o menu
 *
 * Nao e uma tabela de registros: e o proprio menu da vitrine, na mesma ordem
 * e com o mesmo aninhamento. Por isso nao ha colunas, nao ha paginacao e nao
 * ha busca — o que a dona faz aqui e olhar a lista inteira e mexer nela, como
 * se mexesse no cardapio.
 *
 * ## O nome se edita no lugar
 *
 * Um clique no nome o transforma em campo. Enter salva, Escape desiste, e
 * sair do campo salva tambem — renomear uma categoria e a coisa mais comum
 * desta tela, e abrir um dialogo para trocar uma palavra seria pedir tres
 * cliques por um.
 *
 * O que **nao** se edita no lugar e o endereco e o pai: os dois mudam o que a
 * loja responde a um link, e merecem um passo deliberado. Estao no menu de
 * acoes da linha.
 *
 * ## Arrastar tem um caminho de teclado ao lado
 *
 * O arraste e o gesto rapido de quem tem mouse. Cada linha tambem tem "subir"
 * e "descer" no menu, e sao eles que funcionam no teclado e no celular, onde
 * arrastar briga com a rolagem da pagina. Uma arvore que so responde ao
 * arraste e uma arvore que metade das pessoas nao consegue ordenar.
 *
 * ## O que a foto da categoria nao faz aqui
 *
 * O campo `image` existe na API e nenhuma tela da loja o desenha hoje. Um
 * upload por categoria seria interface para um dado que ninguem ve — entra
 * quando a vitrine tiver onde mostra-lo.
 */

export interface CategoryTreeProps {
  tree: readonly AdminCategoryNode[];
  /** Arrastar ou mover soltou numa posicao nova: a arvore ja vem reordenada. */
  onReorder: (tree: AdminCategoryNode[]) => void;
  onRename: (category: AdminCategory, name: string) => void;
  onToggleActive: (category: AdminCategory) => void;
  onAddChild: (parent: AdminCategoryNode) => void;
  /** Abre o dialogo de endereco e categoria pai. */
  onEdit: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
  /** Uma reordenacao em voo: o arraste para ate a resposta chegar. */
  isReordering?: boolean;
}

export function CategoryTree({
  tree,
  onReorder,
  onRename,
  onToggleActive,
  onAddChild,
  onEdit,
  onDelete,
  isReordering = false,
}: CategoryTreeProps) {
  // Quem esta sendo arrastado, e de qual lista. Um filho so pode ser solto
  // entre os irmaos dele: `parentId` guarda de onde o gesto saiu.
  const [dragging, setDragging] = useState<{ parentId: string | null; index: number } | null>(null);
  const [over, setOver] = useState<{ parentId: string | null; index: number } | null>(null);

  const clear = (): void => {
    setDragging(null);
    setOver(null);
  };

  const drop = (parentId: string | null, index: number): void => {
    if (dragging !== null && dragging.parentId === parentId) {
      onReorder(
        parentId === null
          ? moveParent(tree, dragging.index, index)
          : moveChild(tree, parentId, dragging.index, index),
      );
    }

    clear();
  };

  const move = (parentId: string | null, from: number, to: number): void => {
    onReorder(parentId === null ? moveParent(tree, from, to) : moveChild(tree, parentId, from, to));
  };

  return (
    <ul className={cx(styles.tree, isReordering && styles.busy)}>
      {tree.map((parent, index) => (
        <li key={parent.id}>
          <Row
            category={parent}
            depth={0}
            position={index}
            total={tree.length}
            dragging={dragging?.parentId === null && dragging.index === index}
            isDropTarget={over?.parentId === null && over.index === index}
            onDragStart={() => {
              setDragging({ parentId: null, index });
            }}
            onDragEnd={clear}
            onDragOver={() => {
              setOver({ parentId: null, index });
            }}
            onDrop={() => {
              drop(null, index);
            }}
            onMove={(to) => {
              move(null, index, to);
            }}
            onRename={onRename}
            onToggleActive={onToggleActive}
            onEdit={onEdit}
            onDelete={onDelete}
            extraItems={[
              {
                label: 'Adicionar subcategoria',
                icon: PlusIcon,
                onSelect: () => {
                  onAddChild(parent);
                },
              },
            ]}
          />

          {parent.children.length === 0 ? null : (
            <ul className={styles.children}>
              {parent.children.map((child, childIndex) => (
                <li key={child.id}>
                  <Row
                    category={child}
                    depth={1}
                    position={childIndex}
                    total={parent.children.length}
                    dragging={dragging?.parentId === parent.id && dragging.index === childIndex}
                    isDropTarget={over?.parentId === parent.id && over.index === childIndex}
                    onDragStart={() => {
                      setDragging({ parentId: parent.id, index: childIndex });
                    }}
                    onDragEnd={clear}
                    onDragOver={() => {
                      setOver({ parentId: parent.id, index: childIndex });
                    }}
                    onDrop={() => {
                      drop(parent.id, childIndex);
                    }}
                    onMove={(to) => {
                      move(parent.id, childIndex, to);
                    }}
                    onRename={onRename}
                    onToggleActive={onToggleActive}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    extraItems={[]}
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

/* ---- Uma linha ------------------------------------------------------------ */

interface RowProps {
  category: AdminCategory;
  depth: 0 | 1;
  position: number;
  total: number;
  dragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onMove: (to: number) => void;
  onRename: (category: AdminCategory, name: string) => void;
  onToggleActive: (category: AdminCategory) => void;
  onEdit: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
  extraItems: RowMenuItem[];
}

function Row({
  category,
  depth,
  position,
  total,
  dragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMove,
  onRename,
  onToggleActive,
  onEdit,
  onDelete,
  extraItems,
}: RowProps) {
  const items: RowMenuItem[] = [
    ...extraItems,
    {
      label: 'Endereco e posicao',
      icon: PencilIcon,
      onSelect: () => {
        onEdit(category);
      },
    },
    {
      label: 'Subir',
      icon: ArrowUpIcon,
      disabled: position === 0,
      onSelect: () => {
        onMove(position - 1);
      },
    },
    {
      label: 'Descer',
      icon: ArrowDownIcon,
      disabled: position === total - 1,
      onSelect: () => {
        onMove(position + 1);
      },
    },
    {
      label: 'Excluir',
      icon: TrashIcon,
      tone: 'danger',
      separated: true,
      onSelect: () => {
        onDelete(category);
      },
    },
  ];

  return (
    <div
      className={cx(
        styles.row,
        depth === 1 && styles.child,
        dragging && styles.dragging,
        isDropTarget && !dragging && styles.dropTarget,
        !category.isActive && styles.inactive,
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event: DragEvent) => {
        // Sem isto o navegador recusa o solte: `dragover` so libera o alvo
        // quando o comportamento padrao e cancelado.
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        onDrop();
      }}
    >
      {/*
        A alca e decorativa: a linha inteira ja e arrastavel, e o icone existe
        para anunciar isso. Quem usa teclado tem "subir" e "descer" no menu,
        que e o caminho de verdade.
      */}
      <GripIcon className={styles.grip} />

      <NameField category={category} onRename={onRename} />

      <span className={styles.count} title={`${String(category.productCount)} produtos`}>
        {category.productCount}
      </span>

      {category.isActive ? null : <Badge variant="muted">fora do menu</Badge>}

      <Switch
        label={`Mostrar ${category.name} no menu da loja`}
        hideLabel
        checked={category.isActive}
        className={styles.switch}
        onChange={() => {
          onToggleActive(category);
        }}
      />

      <RowMenu label={category.name} items={items} />
    </div>
  );
}

/* ---- O nome, editavel no lugar --------------------------------------------- */

/**
 * O nome vira campo ao clique e volta a texto ao sair.
 *
 * O botao e um `<button>` de verdade, e nao um `<span onClick>`: assim ele
 * entra na navegacao por teclado e e anunciado como algo que se aciona. O
 * `aria-label` diz o que o clique faz, porque "Masculino" sozinho nao explica
 * que ele abre a edicao.
 *
 * Salvar num nome vazio nao acontece: o servidor exige duas letras, e um
 * campo apagado por engano voltaria como erro depois da chamada. Aqui ele
 * simplesmente volta ao nome anterior, que e o que a pessoa esperava do
 * Escape que ela nao apertou.
 */
function NameField({
  category,
  onRename,
}: {
  category: AdminCategory;
  onRename: (category: AdminCategory, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      input.current?.select();
    }
  }, [editing]);

  const commit = (): void => {
    const name = draft.trim();

    setEditing(false);

    if (name.length < 2 || name === category.name) {
      setDraft(category.name);
      return;
    }

    onRename(category, name);
  };

  const cancel = (): void => {
    setDraft(category.name);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className={styles.name}
        aria-label={`Renomear ${category.name}`}
        onClick={() => {
          setDraft(category.name);
          setEditing(true);
        }}
      >
        {category.name}
      </button>
    );
  }

  return (
    <input
      ref={input}
      type="text"
      value={draft}
      maxLength={CATEGORY_LIMITS.name}
      aria-label={`Nome de ${category.name}`}
      className={styles.nameInput}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
}
