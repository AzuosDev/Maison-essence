import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProduct,
  deleteProduct,
  fetchAdminProduct,
  listProducts,
  updateProduct,
  updateProductStatus,
} from './admin.api';
import { adminKeys, type AdminProductListParams } from './admin.keys';
import type {
  AdminPage,
  AdminProduct,
  CreateProductInput,
  UpdateProductInput,
} from './admin.types';

/**
 * O catalogo, do ponto de vista de quem o mantem.
 *
 * ## Um minuto de frescor
 *
 * Mais que os pedidos, e de proposito. Pedido chega sozinho o dia inteiro;
 * produto muda quando alguem o edita, e quem edita esta nesta tela e recebe a
 * invalidacao na hora. Consultar de novo a cada troca de aba so gastaria
 * rede.
 *
 * ## A invalidacao alcanca a abertura do painel
 *
 * `useDashboard` monta as consultas dele com `adminKeys.productList(...)`,
 * debaixo da mesma raiz. Invalidar `adminKeys.products()` corrige junto o
 * card de "Sem estoque" e o aviso de estoque acabando — que sao exatamente os
 * numeros que mudam quando a dona acaba de cadastrar ou desativar algo.
 */
const STALE_TIME_MS = 60_000;

export function useProducts(params: AdminProductListParams) {
  return useQuery({
    queryKey: adminKeys.productList(params),
    queryFn: ({ signal }) => listProducts(params, signal),
    staleTime: STALE_TIME_MS,

    // A lista anterior fica na tela enquanto a nova vem: sem isto, cada letra
    // digitada na busca apaga os resultados e devolve o esqueleto.
    placeholderData: (previous) => previous,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: adminKeys.product(id),
    queryFn: ({ signal }) => fetchAdminProduct(id, signal),
    staleTime: STALE_TIME_MS,
    enabled: id !== '',
  });
}

/**
 * Publica e despublica pela tabela, com o interruptor virando no dedo.
 *
 * E a acao mais repetida da tela, e a que mais se faz em sequencia: a dona
 * desativa quatro produtos que acabaram enquanto confere o estoque. Esperar o
 * servidor a cada um transformaria isso em quatro pausas.
 *
 * O retrato guardado e a **pagina inteira**, e nao so a linha alterada. E o
 * caminho mais curto para ficar correto quando duas linhas sao viradas quase
 * ao mesmo tempo: cada mutacao restaura o retrato que ela mesma viu.
 */
export function useSetProductStatus(params: AdminProductListParams) {
  const client = useQueryClient();
  const key = adminKeys.productList(params);

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateProductStatus(id, isActive),

    onMutate: async ({ id, isActive }) => {
      await client.cancelQueries({ queryKey: key });

      const previous = client.getQueryData<AdminPage<AdminProduct>>(key);

      client.setQueryData<AdminPage<AdminProduct>>(key, (current) =>
        current === undefined
          ? current
          : {
              ...current,
              items: current.items.map((product) =>
                product.id === id ? { ...product, isActive } : product,
              ),
            },
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(key, context.previous);
      }
    },

    // No sucesso tambem: o servidor mexeu no `updatedAt`, e o card de "Sem
    // estoque" da abertura conta so os publicados.
    onSettled: () => {
      void client.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}

/**
 * O que salvar: um cadastro novo ou a edicao de um que existe.
 *
 * Uniao discriminada pelo `id`, e nao um `id` opcional com o mesmo corpo nos
 * dois lados. A diferenca nao e cosmetica: `CreateProductInput` tem `slug` e
 * `UpdateProductInput` nao, porque o endereco do produto ja foi para o
 * WhatsApp de alguem e nao se troca numa edicao. Com um tipo so, o `slug`
 * viajava no `PATCH` sem que nada reclamasse — e o servidor o ignorava em
 * silencio, que e a pior forma de estar errado.
 */
export type SaveProductInput =
  { id?: undefined; input: CreateProductInput } | { id: string; input: UpdateProductInput };

/**
 * Salva o cadastro: cria quando nao ha id, edita quando ha.
 *
 * Uma mutacao so para os dois caminhos porque a tela e a mesma e o que ela
 * faz depois tambem e o mesmo — mostrar o aviso e voltar para a lista. O que
 * separa `POST` de `PATCH` e o tipo acima, e nao um casting.
 */
export function useSaveProduct() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (variables: SaveProductInput) =>
      variables.id === undefined
        ? createProduct(variables.input)
        : updateProduct(variables.id, variables.input),

    onSuccess: (product) => {
      // O produto que voltou e o mais novo que existe: entra no cache do
      // detalhe antes da invalidacao, para que voltar ao formulario nao mostre
      // o esqueleto de algo que acabou de ser salvo.
      client.setQueryData(adminKeys.product(product.id), product);

      void client.invalidateQueries({ queryKey: adminKeys.products() });
      // As contagens por categoria mudam quando um produto entra ou sai de uma.
      void client.invalidateQueries({ queryKey: adminKeys.categories() });
    },
  });
}

/**
 * Apaga o produto.
 *
 * O servidor recusa quando ha pedido apontando para ele — o historico do
 * pedido guarda nome e preco congelados, mas o vinculo continua existindo. A
 * tela mostra a frase de la em vez de traduzi-la: e ela que diz **quantos**
 * pedidos impedem.
 */
export function useDeleteProduct() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),

    onSuccess: (_result, id) => {
      client.removeQueries({ queryKey: adminKeys.product(id) });

      void client.invalidateQueries({ queryKey: adminKeys.products() });
      void client.invalidateQueries({ queryKey: adminKeys.categories() });
    },
  });
}
