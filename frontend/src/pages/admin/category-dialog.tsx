import { useState } from 'react';
import { Button, Input, Modal, Select } from '@/components/ui';
import {
  CATEGORY_LIMITS,
  hasChildren,
  parentOptions,
  type AdminCategory,
  type AdminCategoryNode,
  type UpdateCategoryInput,
} from '@/features/admin';
import styles from './category-dialog.module.css';

/**
 * Criar uma categoria, ou mexer no endereco e na posicao de uma que existe.
 *
 * ## Por que um dialogo, e nao uma pagina
 *
 * Sao tres campos e o contexto importa: a dona esta olhando a arvore e
 * decidindo onde encaixar a categoria nova. Levar para outra pagina tiraria
 * da vista justamente a lista que ela esta consultando para decidir.
 *
 * E a diferenca para o cadastro de produto: aquele tem cinco secoes, fotos e
 * uma tabela, e precisa de endereco proprio para ser retomado depois de uma
 * ligacao. Este se resolve em vinte segundos.
 *
 * ## O endereco muda sem quebrar link
 *
 * Diferente do produto, a categoria guarda os enderecos antigos e o servidor
 * redireciona — e por isso o campo esta aqui tambem na edicao. O aviso ao
 * lado do campo diz isso, para que a decisao nao seja tomada no escuro.
 *
 * ## Quando "dentro de" some
 *
 * Uma subcategoria nao pode ter filhos: se esta categoria ja tem
 * subcategorias, ela nao pode virar subcategoria de ninguem, e o servidor
 * recusa com uma frase propria. Em vez de mostrar um campo que so leva a um
 * erro, a tela o substitui pela explicacao.
 */

export type CategoryDialogTarget =
  { mode: 'create'; parentId: string | null } | { mode: 'edit'; category: AdminCategory };

export interface CategoryDialogProps {
  /** `null` mantem o dialogo fechado. */
  target: CategoryDialogTarget | null;
  tree: readonly AdminCategoryNode[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateCategoryInput) => void;
}

/**
 * O invólucro existe pela `key`.
 *
 * Os campos comecam preenchidos com o que a categoria tem, e "comecam" e a
 * palavra exata: sao `useState` com valor inicial, e nao estado sincronizado
 * por efeito. Trocar de alvo — abrir "Amadeirado" logo depois de "Masculino"
 * — remonta o formulario, e os iniciais rodam de novo.
 *
 * O efeito seria a outra saida, e ele traria um quadro intermediario com o
 * nome anterior no campo. A `key` nao traz.
 */
export function CategoryDialog({ target, ...rest }: CategoryDialogProps) {
  if (target === null) {
    return null;
  }

  return <CategoryForm key={keyOf(target)} target={target} {...rest} />;
}

function keyOf(target: CategoryDialogTarget): string {
  return target.mode === 'edit'
    ? `edit:${target.category.id}`
    : `create:${target.parentId ?? 'raiz'}`;
}

function CategoryForm({
  target,
  tree,
  saving,
  onClose,
  onSubmit,
}: Omit<CategoryDialogProps, 'target'> & { target: CategoryDialogTarget }) {
  const isEdit = target.mode === 'edit';

  const [name, setName] = useState(isEdit ? target.category.name : '');
  const [slug, setSlug] = useState(isEdit ? target.category.slug : '');
  const [parentId, setParentId] = useState(
    target.mode === 'edit' ? (target.category.parentId ?? '') : (target.parentId ?? ''),
  );
  const [touched, setTouched] = useState(false);

  const currentId = target.mode === 'edit' ? target.category.id : '';
  const locked = isEdit && hasChildren(tree, currentId);
  const invalid = name.trim().length < 2;

  const submit = (): void => {
    setTouched(true);

    if (invalid) {
      return;
    }

    onSubmit({
      name: name.trim(),
      // `null` promove a categoria principal; um id a coloca dentro de outra.
      parentId: parentId === '' ? null : parentId,
      // Vazio na criacao faz o servidor gerar o endereco a partir do nome.
      // Na edicao, vazio significaria apagar o endereco — entao ele so viaja
      // quando ha texto.
      ...(slug.trim() === '' ? {} : { slug: slug.trim() }),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Endereço e posição' : 'Nova categoria'}
      description={
        target.mode === 'edit'
          ? target.category.name
          : 'Ela aparece no menu da loja assim que for criada.'
      }
      footer={
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>

          <Button type="button" onClick={submit} loading={saving} loadingLabel="Salvando">
            {isEdit ? 'Salvar' : 'Criar categoria'}
          </Button>
        </div>
      }
    >
      <div className={styles.fields}>
        {/*
          Sem `autoFocus`: o `Modal` ja leva o foco para o primeiro controle
          quando abre, e este e o primeiro. Repetir a instrucao no campo so
          criaria duas fontes para a mesma decisao.
        */}
        <Input
          label="Nome"
          block
          required
          maxLength={CATEGORY_LIMITS.name}
          placeholder="Masculino"
          value={name}
          error={touched && invalid ? 'O nome precisa de ao menos duas letras.' : undefined}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />

        <Input
          label="Endereço na loja"
          block
          maxLength={CATEGORY_LIMITS.slug}
          placeholder={isEdit ? undefined : 'sai do nome'}
          hint={
            isEdit
              ? 'O endereço antigo continua abrindo: a loja redireciona para o novo.'
              : 'Em branco, o sistema monta a partir do nome.'
          }
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
          }}
        />

        {locked ? (
          <p className={styles.locked}>
            Esta categoria tem subcategorias, e uma subcategoria não pode ter filhos. Para coloca-lá
            dentro de outra, mova antes as subcategorias dela.
          </p>
        ) : (
          <Select
            label="Dentro de"
            block
            placeholder="Nenhuma — categoria principal"
            hint="Subcategorias aparecem recuadas no menu da loja."
            options={parentOptions(tree, currentId)}
            value={parentId}
            onChange={(event) => {
              setParentId(event.target.value);
            }}
          />
        )}
      </div>
    </Modal>
  );
}
