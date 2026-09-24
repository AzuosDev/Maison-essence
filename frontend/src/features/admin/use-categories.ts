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
 * A árvore quase não muda, e quem a muda esta nesta tela e recebe a
 * invalidação na hora. Quem mais depende dela — o filtro do catálogo e o
 * seletor do cadastro de produto — a lê muitas vezes por sessão e não pode
 * pagar uma consulta a cada abertura de formulário.
 *
 * ## Toda escrita inválida a árvore inteira
 *
 * Não há chave por categoria. A rota devolve a árvore completa e as
 * contagens de produto do pai somam as dos filhos: mexer numa subcategoria
 * muda o número que aparece no pai, e uma invalidação cirúrgica deixaria esse
 * número errado na linha de cima.
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
 * Salva a edição: nome, endereço, pai, situação.
 *
 * Também e por aqui que a categoria e desativada — inclusive pelo caminho que
 * o 409 de exclusão oferece. Inválida os produtos junto porque despublicar
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
 * Regrava a ordem do menu, com a árvore já reposicionada na tela.
 *
 * O otimismo aqui e a razão de o gesto existir: arrastar uma categoria e
 * vê-lá voltar ao lugar por meio segundo, até o servidor responder, e pior do
 * que não poder arrastar. O retrato anterior volta se a chamada falhar.
 *
 * A resposta do servidor e a árvore reordenada, e ela entra direto no cache:
 * uma invalidação pediria a mesma lista de novo, pelo mesmo resultado.
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
 * ativo. Quem chama lê `blockedBy(error)` para saber quantos são e oferecer
 * desativar no lugar — `category-tree.ts` explica.
 */
export function useDeleteCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.categories() });
      // Excluir solta a referência nos produtos inativos que apontavam para
      // ela: a lista de produtos guarda `categoryIds` e ficou desatualizada.
      void client.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}
