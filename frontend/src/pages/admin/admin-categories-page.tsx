import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { ArrowLeftIcon, CategoryTree, ConfirmDialog, PlusIcon } from '@/components/admin';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';
import {
  blockedBy,
  canManageStore,
  countCategories,
  useAdminCategories,
  useAdminRole,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
  type AdminCategory,
  type AdminCategoryNode,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import { CategoryDialog, type CategoryDialogTarget } from './category-dialog';
import styles from './admin-categories-page.module.css';

/**
 * As categorias.
 *
 * ## Esta tela não lista registros: ela desenha o menu
 *
 * O que esta na tela e o menu da vitrine, na mesma ordem e com o mesmo
 * aninhamento. Por isso não há busca, não há paginação e não há filtro — uma
 * loja de perfumes tem dez ou quinze categorias, e a dona precisa ver todas
 * de uma vez para decidir a ordem entre elas.
 *
 * ## Excluir quase sempre não e o que ela quer
 *
 * O servidor recusa apagar categoria com subcategoria ou produto ativo, e
 * manda as contagens junto. A tela usa esses números para oferecer
 * **desativar** ali mesmo: some do menu da loja e nenhum produto sai do
 * lugar, que e o que ela queria em quase todo caso.
 *
 * ## O que o STAFF vê
 *
 * Nada. O menu da loja e cadastro, e o recorte do papel já esconde o item no
 * menu lateral — esta tela só recusa quem digitou o endereço.
 */
export default function AdminCategoriesPage() {
  const role = useAdminRole();
  const { toast } = useToast();

  const { data: tree, isPending, isError, error } = useAdminCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const reorder = useReorderCategories();
  const remove = useDeleteCategory();

  const [dialog, setDialog] = useState<CategoryDialogTarget | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);

  usePageMeta({ title: 'Categorias — Painel', description: 'Acesso restrito.' });

  if (!canManageStore(role)) {
    return (
      <EmptyState
        as="h1"
        title="Esta área e de quem administra a loja"
        description="O menu da vitrine e cadastro. O seu acesso cobre o atendimento: o início do painel e os pedidos."
        actions={
          <Link to={ROUTES.admin.root} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o início
          </Link>
        }
      />
    );
  }

  const fail = (title: string) => (cause: unknown) => {
    toast({ variant: 'danger', title, description: errorMessage(cause) });
  };

  /**
   * Desativa a categoria.
   *
   * E a saída que o 409 de exclusão oferece, e também o que o interruptor da
   * linha faz. Uma função só para os dois porque o efeito e o mesmo: a
   * categoria some do menu da loja sem que nenhum produto mude de lugar.
   */
  const deactivate = (category: AdminCategory): void => {
    update.mutate(
      { id: category.id, input: { isActive: false } },
      {
        onSuccess: () => {
          setDeleting(null);
          toast({
            variant: 'success',
            title: `${category.name} saiu do menu`,
            description: 'Os produtos dela continuam onde estavam.',
          });
        },
        onError: fail('A categoria continua como estava'),
      },
    );
  };

  /** Fecha o diálogo e avisa, depois de criar ou salvar. */
  const saved = (name: string) => () => {
    setDialog(null);
    toast({ variant: 'success', title: `${name} foi salva` });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={styles.title}>Categorias</h1>

          <p className={styles.count} aria-live="polite">
            {summary(tree, isPending)}
          </p>
        </div>

        <Button
          type="button"
          className={styles.add}
          onClick={() => {
            setDialog({ mode: 'create', parentId: null });
          }}
        >
          <PlusIcon />
          Nova categoria
        </Button>
      </header>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : isPending ? (
        <div className={styles.skeleton} aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height="3rem" />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <EmptyState
          as="h2"
          title="O menu da loja esta vazio"
          description="As categorias são como a cliente encontra o que procura: Masculino, Feminino, Árabes. Crie a primeira e depois arraste para ordenar."
          actions={
            <Button
              type="button"
              onClick={() => {
                setDialog({ mode: 'create', parentId: null });
              }}
            >
              Criar a primeira categoria
            </Button>
          }
        />
      ) : (
        <>
          <p className={styles.hint}>
            Arraste para mudar a ordem do menu, ou use subir e descer no menu de cada linha. Clique
            no nome para renomear.
          </p>

          <CategoryTree
            tree={tree}
            isReordering={reorder.isPending}
            onReorder={(next) => {
              reorder.mutate(next, { onError: fail('A ordem voltou ao que era') });
            }}
            onRename={(category, name) => {
              update.mutate(
                { id: category.id, input: { name } },
                { onError: fail('O nome continua como estava') },
              );
            }}
            onToggleActive={(category) => {
              update.mutate(
                { id: category.id, input: { isActive: !category.isActive } },
                { onError: fail('A categoria continua como estava') },
              );
            }}
            onAddChild={(parent) => {
              setDialog({ mode: 'create', parentId: parent.id });
            }}
            onEdit={(category) => {
              setDialog({ mode: 'edit', category });
            }}
            onDelete={setDeleting}
          />
        </>
      )}

      <CategoryDialog
        target={dialog}
        tree={tree ?? []}
        saving={create.isPending || update.isPending}
        onClose={() => {
          setDialog(null);
        }}
        onSubmit={(input) => {
          if (dialog?.mode === 'edit') {
            update.mutate(
              { id: dialog.category.id, input },
              {
                onSuccess: saved(input.name ?? dialog.category.name),
                onError: fail('Não deu para salvar'),
              },
            );

            return;
          }

          create.mutate(
            { ...input, name: input.name ?? '' },
            { onSuccess: saved(input.name ?? ''), onError: fail('Não deu para criar a categoria') },
          );
        }}
      />

      <DeleteDialog
        category={deleting}
        loading={remove.isPending || update.isPending}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting === null) {
            return;
          }

          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast({ variant: 'success', title: `${deleting.name} foi excluída` });
            },
            onError: (cause) => {
              const blocked = blockedBy(cause);

              if (blocked === null) {
                setDeleting(null);
                fail('A categoria não foi excluída')(cause);

                return;
              }

              // O diálogo fica aberto: a mensagem do servidor diz o que
              // impede, e a oferta de desativar continua a um clique.
              toast({
                variant: 'danger',
                title: `${deleting.name} não esta vazia`,
                description: errorMessage(cause),
              });
            },
          });
        }}
        onDeactivate={() => {
          if (deleting !== null) {
            deactivate(deleting);
          }
        }}
      />
    </div>
  );
}

/* ---- A confirmação de exclusão ---------------------------------------------- */

/**
 * Confirmar a exclusão, com a saída ao lado.
 *
 * Não e um `ConfirmDialog` puro porque esta ação tem **três** respostas, e
 * não duas: apagar, desistir e "na verdade eu só queria tirar do menu". A
 * terceira e a que a dona quer em quase todo caso, e escondê-lá atrás de uma
 * mensagem de erro seria fazê-lá descobrir por tentativa.
 */
function DeleteDialog({
  category,
  loading,
  onClose,
  onConfirm,
  onDeactivate,
}: {
  category: AdminCategory | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDeactivate: () => void;
}) {
  return (
    <ConfirmDialog
      open={category !== null}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Excluir esta categoria?"
      description={
        <>
          Só sai se estiver vazia: sem subcategorias e sem produto ativo dentro dela.
          {category?.isActive === true ? (
            <>
              {' '}
              Se a ideia e apenas tira-lá do menu da loja,{' '}
              <button type="button" className={styles.inlineAction} onClick={onDeactivate}>
                desative
              </button>{' '}
              em vez de excluir — os produtos continuam onde estão.
            </>
          ) : null}
        </>
      }
      target={category?.name ?? ''}
      confirmLabel="Excluir a categoria"
      loading={loading}
    />
  );
}

/* ---- A linha de contagem ------------------------------------------------------ */

function summary(tree: readonly AdminCategoryNode[] | undefined, isPending: boolean): string {
  if (isPending || tree === undefined) {
    return 'Carregando o menu';
  }

  const total = countCategories(tree);

  if (total === 0) {
    return 'Nenhuma categoria ainda';
  }

  const children = total - tree.length;
  const main = `${String(tree.length)} ${tree.length === 1 ? 'principal' : 'principais'}`;

  return children === 0
    ? `${main}, sem subcategorias`
    : `${main} e ${String(children)} ${children === 1 ? 'subcategoria' : 'subcategorias'}`;
}
