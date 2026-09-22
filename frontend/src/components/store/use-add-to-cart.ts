import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useToast } from '@/components/ui';
import { useCart } from '@/features/cart';
import type { PublicProduct, PublicVariant } from '@/features/catalog';

/**
 * Por em uma linha na sacola, do jeito certo, em um lugar so.
 *
 * O card, o seletor rapido e a pagina do produto adicionam o mesmo item, e as
 * tres coisas que acontecem no clique precisam acontecer juntas: a linha
 * entra, a gaveta abre e o aviso aparece. Espalhar isso pelos tres chamadores
 * significaria, mais cedo ou mais tarde, um lugar da loja em que adicionar
 * nao abre a gaveta.
 *
 * ## O que vai para a sacola, e o que vai junto
 *
 * A **linha** tem tres campos: produto, variante e quantidade. E o que o
 * servidor cota e e o unico formato que atravessa o `localStorage` — nenhum
 * preco daqui e guardado, porque o preco que este card esta mostrando pode
 * ser o de ontem quando o cliente voltar.
 *
 * A **dica** tem nome, foto e rotulo da opcao, e vive so em memoria. E o que
 * permite a gaveta abrir cheia no mesmo quadro do clique, sem esperar os
 * 400ms de debounce mais a ida ao servidor. A foto e a da variante, e nao a
 * capa do produto: comprar o Asad de 100ml e ver a miniatura do de 50ml na
 * sacola e o tipo de detalhe que faz o cliente reabrir tudo para conferir.
 *
 * O estoque nao e copiado. Quem diz quanto ainda da para levar e a cotacao,
 * a cada recalculo — e a sacola prende o seletor de quantidade nesse numero,
 * que e o de agora, e nao no que este card viu ha meia hora.
 */
export function useAddToCart() {
  const addLine = useCart((state) => state.addLine);
  const openDrawer = useCart((state) => state.openDrawer);
  const closeDrawer = useCart((state) => state.closeDrawer);
  const { toast } = useToast();

  // O `ToastProvider` esta por fora do router, entao quem navega a partir do
  // aviso e este hook — que roda dentro dele. Ver a nota em `toast.tsx`.
  const navigate = useNavigate();

  return useCallback(
    (product: PublicProduct, variant: PublicVariant, quantity = 1) => {
      addLine(
        { productId: product.id, variantId: variant.id, quantity },
        {
          name: product.name,
          slug: product.slug,
          variantLabel: variant.label,
          image: variant.image === '' ? product.coverImage : variant.image,
        },
      );

      openDrawer();

      toast({
        title: 'Adicionado a sacola',
        description: variant.label === '' ? product.name : `${product.name} · ${variant.label}`,
        variant: 'success',
        action: {
          label: 'Ver a sacola',
          onSelect: () => {
            // A gaveta fecha antes de navegar: chegar na pagina da sacola
            // com a gaveta da sacola aberta por cima e a mesma lista duas
            // vezes, uma escondendo a outra.
            closeDrawer();
            void navigate(ROUTES.cart);
          },
        },
      });
    },
    [addLine, openDrawer, closeDrawer, navigate, toast],
  );
}
