import { useCallback } from 'react';
import { useToast } from '@/components/ui';
import { useCart } from '@/features/cart';
import type { PublicProduct, PublicVariant } from '@/features/catalog';

/**
 * Por em uma linha na sacola, do jeito certo, em um lugar so.
 *
 * O card, o seletor rapido e a pagina do produto adicionam o mesmo item, e a
 * traducao de "produto mais variante" para `CartLine` tem dois pontos em que
 * se erra calado:
 *
 * - a **foto** da linha e a da variante, e nao a de capa do produto. Comprar
 *   o Asad de 100ml e ver a miniatura do de 50ml na sacola e o tipo de
 *   detalhe que faz o cliente reabrir tudo para conferir;
 * - o **estoque** guardado e `null` quando a venda e sob encomenda. Guardar o
 *   zero de `stock` faria o seletor de quantidade da sacola travar em zero
 *   num produto que esta a venda.
 *
 * O preco copiado aqui e so para o resumo lateral desenhar sem rede. Quem diz
 * quanto custa e `POST /cart/quote`, que recalcula tudo no servidor.
 */
export function useAddToCart() {
  const addLine = useCart((state) => state.addLine);
  const { toast } = useToast();

  return useCallback(
    (product: PublicProduct, variant: PublicVariant, quantity = 1) => {
      addLine({
        productId: product.id,
        variantId: variant.id,
        quantity,
        name: product.name,
        slug: product.slug,
        variantLabel: variant.label,
        image: variant.image === '' ? product.coverImage : variant.image,
        unitPriceCents: variant.priceCents,
        availableStock: variant.onDemand ? null : variant.stock,
      });

      toast({
        title: 'Adicionado a sacola',
        description: variant.label === '' ? product.name : `${product.name} · ${variant.label}`,
        variant: 'success',
      });
    },
    [addLine, toast],
  );
}
