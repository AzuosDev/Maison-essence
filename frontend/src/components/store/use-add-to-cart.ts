import { useCallback } from 'react';
import { useCart } from '@/features/cart';
import type { PublicProduct, PublicVariant } from '@/features/catalog';

/**
 * Por em uma linha na sacola, do jeito certo, em um lugar só.
 *
 * O card, o seletor rápido e a página do produto adicionam o mesmo item, e as
 * duas coisas que acontecem no clique precisam acontecer juntas: a linha
 * entra e a gaveta abre. Espalhar isso pelos três chamadores significaria,
 * mais cedo ou mais tarde, um lugar da loja em que adicionar não abre a
 * gaveta.
 *
 * ## Por que não há aviso passageiro aqui
 *
 * Havia, e ele dizia "Adicionado a sacola" com um atalho "Ver a sacola" —
 * exatamente o que a gaveta que acabou de abrir já mostra, com o item, a
 * miniatura e o subtotal. Dois avisos do mesmo fato, e o de baixo por cima do
 * outro: o `--z-toast` e maior que o `--z-drawer`, e no celular o aviso
 * ocupa a largura inteira do rodapé — bem onde ficam "Finalizar compra",
 * "Continuar comprando" e "Ver a sacola inteira". A confirmação tapava os
 * botões que ela mandava usar.
 *
 * Para quem ouve a página também não se perdeu nada: a gaveta e um
 * `role="dialog"` com `aria-modal` e título, e abri-lá já anuncia "Sua
 * sacola".
 *
 * O `ToastProvider` continua de pé para o resto da loja — o que ele avisa são
 * as coisas que não tem tela própria: falha ao salvar, pedido enviado, senha
 * trocada.
 *
 * ## O que vai para a sacola, e o que vai junto
 *
 * A **linha** tem três campos: produto, variante e quantidade. E o que o
 * servidor cota e e o único formato que atravessa o `localStorage` — nenhum
 * preço daqui e guardado, porque o preço que este card esta mostrando pode
 * ser o de ontem quando o cliente voltar.
 *
 * A **dica** tem nome, foto e rótulo da opção, e vive só em memória. E o que
 * permite a gaveta abrir cheia no mesmo quadro do clique, sem esperar os
 * 400ms de debounce mais a ida ao servidor. A foto e a da variante, e não a
 * capa do produto: comprar o Asad de 100ml e ver a miniatura do de 50ml na
 * sacola e o tipo de detalhe que faz o cliente reabrir tudo para conferir.
 *
 * O estoque não e copiado. Quem diz quanto ainda da para levar e a cotação,
 * a cada recálculo — e a sacola prende o seletor de quantidade nesse número,
 * que e o de agora, e não no que este card viu há meia hora.
 */
export function useAddToCart() {
  const addLine = useCart((state) => state.addLine);
  const openDrawer = useCart((state) => state.openDrawer);

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
    },
    [addLine, openDrawer],
  );
}
