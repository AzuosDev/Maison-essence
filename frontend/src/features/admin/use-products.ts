import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProduct,
  deleteProduct,
  fetchAdminProduct,
  listProducts,
  setProductReadyToShip,
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
 * O catálogo, do ponto de vista de quem o mantem.
 *
 * ## Um minuto de frescor
 *
 * Mais que os pedidos, e de propósito. Pedido chega sozinho o dia inteiro;
 * produto muda quando alguém o edita, e quem edita esta nesta tela e recebe a
 * invalidação na hora. Consultar de novo a cada troca de aba só gastaria
 * rede.
 *
 * ## A invalidação alcança a abertura do painel
 *
 * `useDashboard` monta as consultas dele com `adminKeys.productList(...)`,
 * debaixo da mesma raiz. Invalidar `adminKeys.products()` corrige junto o
 * card de "Sem estoque" e o aviso de estoque acabando — que são exatamente os
 * números que mudam quando a dona acaba de cadastrar ou desativar algo.
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
 * E a ação mais repetida da tela, e a que mais se faz em sequência: a dona
 * desativa quatro produtos que acabaram enquanto confere o estoque. Esperar o
 * servidor a cada um transformaria isso em quatro pausas.
 *
 * O retrato guardado e a **página inteira**, e não só a linha alterada. E o
 * caminho mais curto para ficar correto quando duas linhas são viradas quase
 * ao mesmo tempo: cada mutação restaura o retrato que ela mesma viu.
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

    // No sucesso também: o servidor mexeu no `updatedAt`, e o card de "Sem
    // estoque" da abertura conta só os publicados.
    onSettled: () => {
      void client.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}

/**
 * O que salvar: um cadastro novo ou a edição de um que existe.
 *
 * União discriminada pelo `id`, e não um `id` opcional com o mesmo corpo nos
 * dois lados. A diferença não e cosmética: `CreateProductInput` tem `slug` e
 * `UpdateProductInput` não, porque o endereço do produto já foi para o
 * WhatsApp de alguém e não se troca numa edição. Com um tipo só, o `slug`
 * viajava no `PATCH` sem que nada reclamasse — e o servidor o ignorava em
 * silêncio, que e a pior forma de estar errado.
 */
export type SaveProductInput =
  { id?: undefined; input: CreateProductInput } | { id: string; input: UpdateProductInput };

/**
 * Salva o cadastro: cria quando não há id, edita quando há.
 *
 * Uma mutação só para os dois caminhos porque a tela e a mesma e o que ela
 * faz depois também e o mesmo — mostrar o aviso e voltar para a lista. O que
 * separa `POST` de `PATCH` e o tipo acima, e não um casting.
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
      // detalhe antes da invalidação, para que voltar ao formulário não mostre
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
 * O servidor recusa quando há pedido apontando para ele — o histórico do
 * pedido guarda nome e preço congelados, mas o vínculo continua existindo. A
 * tela mostra a frase de lá em vez de traduzi-lá: e ela que diz **quantos**
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

/**
 * Põe ou tira o produto da prateleira de pronta entrega.
 *
 * ## A linha some, e isso e o certo
 *
 * A tela de pronta entrega mostra só o que esta na prateleira. Tirar um
 * produto dela e tira-lo da lista — manter a linha lá, com o interruptor
 * desligado, seria a tela discordando do próprio recorte, e a contagem do
 * cabeçalho passaria a mentir enquanto a dona confere o estoque.
 *
 * O caminho de volta não e desfazer a some: e o "Desfazer" do aviso, que a
 * tela oferece. Por isso a mutação devolve o produto — quem chama precisa
 * dele para saber o que religar.
 *
 * ## Por que otimista aqui, ao contrário da taxa de entrega
 *
 * Porque o gesto e uma conferência de prateleira: dez produtos em sequência,
 * com a dona olhando para a caixa e não para a tela. Esperar a rede a cada
 * clique transformaria a conferência numa fila de esperas — e, diferente de
 * um preço, o que se vê aqui e uma presença, não um número que precisa estar
 * certo no centavo.
 */
export function useSetReadyToShip(params: AdminProductListParams) {
  const client = useQueryClient();
  const key = adminKeys.productList(params);

  return useMutation({
    mutationFn: ({ id, isReadyToShip }: { id: string; isReadyToShip: boolean }) =>
      setProductReadyToShip(id, isReadyToShip),

    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: key });

      const previous = client.getQueryData<AdminPage<AdminProduct>>(key);

      client.setQueryData<AdminPage<AdminProduct>>(key, (current) =>
        current === undefined
          ? current
          : {
              ...current,
              items: current.items.filter((product) => product.id !== id),
              // A contagem acompanha: ela e o que a dona esta conferindo, e
              // vê-lá parada enquanto a lista encurta e pior do que não vê-lá.
              totalItems: Math.max(current.totalItems - 1, 0),
            },
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(key, context.previous);
      }
    },

    onSettled: () => {
      void client.invalidateQueries({ queryKey: adminKeys.products() });
    },
  });
}
