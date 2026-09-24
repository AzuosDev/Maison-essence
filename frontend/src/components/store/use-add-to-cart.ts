import { useCallback } from 'react';
import { useCart } from '@/features/cart';
import type { PublicProduct, PublicVariant } from '@/features/catalog';

/**
 * Por em uma linha na sacola, do jeito certo, em um lugar so.
 *
 * O card, o seletor rapido e a pagina do produto adicionam o mesmo item, e as
 * duas coisas que acontecem no clique precisam acontecer juntas: a linha
 * entra e a gaveta abre. Espalhar isso pelos tres chamadores significaria,
 * mais cedo ou mais tarde, um lugar da loja em que adicionar nao abre a
 * gaveta.
 *
 * ## Por que nao ha aviso passageiro aqui
 *
 * Havia, e ele dizia "Adicionado a sacola" com um atalho "Ver a sacola" —
 * exatamente o que a gaveta que acabou de abrir ja mostra, com o item, a
 * miniatura e o subtotal. Dois avisos do mesmo fato, e o de baixo por cima do
 * outro: o `--z-toast` e maior que o `--z-drawer`, e no celular o aviso
 * ocupa a largura inteira do rodape — bem onde ficam "Finalizar compra",
 * "Continuar comprando" e "Ver a sacola inteira". A confirmacao tapava os
 * botoes que ela mandava usar.
 *
 * Para quem ouve a pagina tambem nao se perdeu nada: a gaveta e um
 * `role="dialog"` com `aria-modal` e titulo, e abri-la ja anuncia "Sua
 * sacola".
 *
 * O `ToastProvider` continua de pe para o resto da loja — o que ele avisa sao
 * as coisas que nao tem tela propria: falha ao salvar, pedido enviado, senha
 * trocada.
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
