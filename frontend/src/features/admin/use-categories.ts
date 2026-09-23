import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  reorderCategories,
  updateCategory,
} from './admin.api';
import { adminKeys } from './admin.keys';
import type { AdminCategoryNode, CreateCategoryInput, UpdateCategoryInput } from './admin.types';
import { menuOrder } from './category-tree';

/**
 * As categorias, do ponto de vista de quem monta o menu da loja.
 *
 * ## Cinco minutos de frescor
 *
 * A arvore quase nao muda, e quem a muda esta nesta tela e recebe a
 * invalidacao na hora. Quem mais depende dela — o filtro do catalogo e o
 * seletor do cadastro de produto — a le muitas vezes por sessao e nao pode
 * pagar uma consulta a cada abertura de formulario.
 *
 * ## Toda escrita invalida a arvore inteira
 *
 * Nao ha chave por categoria. A rota devolve a arvore completa e as
 * contagens de produto do pai somam as dos filhos: mexer numa subcategoria
 * muda o numero que aparece no pai, e uma invalidacao cirurgica deixaria esse
 * numero errado na linha de cima.
 */
const STALE_TIME_MS = 5 * 60_000;

export function useAdminCategories() {
  return useQuery({
    queryKey: adminKeys.categories(),
    queryFn: ({ signal }) => listAdminCategories(signal),
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => createCategory(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories() });
    },
  });
}

/**
 * Salva a edicao: nome, endereco, pai, situacao.
 *
 * Tambem e por aqui que a categoria e desativada — inclusive pelo caminho que
 * o 409 de exclusao oferece. Invalida os produtos junto porque despublicar
 * uma categoria muda o que a vitrine mostra, e o painel de produtos filtra
 * por ela.
 */
export function useUpdateCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      updateCategory(id, input),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories() });
      void client.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}

/**
 * Regrava a ordem do menu, com a arvore ja reposicionada na tela.
 *
 * O otimismo aqui e a razao de o gesto existir: arrastar uma categoria e
 * ve-la voltar ao lugar por meio segundo, ate o servidor responder, e pior do
 * que nao poder arrastar. O retrato anterior volta se a chamada falhar.
 *
 * A resposta do servidor e a arvore reordenada, e ela entra direto no cache:
 * uma invalidacao pediria a mesma lista de novo, pelo mesmo resultado.
 */
export function useReorderCategories() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (tree: readonly AdminCategoryNode[]) => reorderCategories(menuOrder(tree)),

    onMutate: async (tree) => {
      await client.cancelQueries({ queryKey: adminKeys.categories() });

      const previous = client.getQueryData<AdminCategoryNode[]>(adminKeys.categories());

      client.setQueryData<AdminCategoryNode[]>(adminKeys.categories(), [...tree]);

      return { previous };
    },

    onError: (_error, _tree, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(adminKeys.categories(), context.previous);
      }
    },

    onSuccess: (reordered) => {
      client.setQueryData(adminKeys.categories(), reordered);
    },
  });
}

/**
 * Exclui a categoria.
 *
 * O servidor recusa com 409 quando ela ainda tem subcategoria ou produto
 * ativo. Quem chama le `blockedBy(error)` para saber quantos sao e oferecer
 * desativar no lugar — `category-tree.ts` explica.
 */
export function useDeleteCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories() });
      // Excluir solta a referencia nos produtos inativos que apontavam para
      // ela: a lista de produtos guarda `categoryIds` e ficou desatualizada.
      void client.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}
