import { Suspense, lazy } from 'react';
import { useCart } from '@/features/cart';

/**
 * A sacola que abre sozinha ao adicionar.
 *
 * Existe para responder, no ato, a pergunta que todo "adicionar ao carrinho"
 * levanta: *entrou mesmo?* Um toast responde pela metade — diz que entrou,
 * não mostra o que entrou nem quanto já da o total. A gaveta mostra as duas
 * coisas e oferece as duas saídas, continuar ou fechar, sem tirar o cliente
 * da página em que ele estava.
 *
 * ## Este arquivo e só o interruptor
 *
 * Ele lê um booleano do store e mais nada. Todo o resto — a lista, o resumo,
 * a cotação, o vazio com a ilustração — mora em `cart-drawer-panel`, que
 * entra por `lazy`.
 *
 * A razão e de empacotamento, e e a mesma de `DeferredNewsletter`: a moldura
 * da loja importa esta gaveta, e o que ela importar de forma estática viaja
 * no pedaço inicial de **toda** visita. Quem abriu a home para ver um
 * perfume e foi embora não deveria baixar a sacola inteira no caminho.
 *
 * Sem `fallback` visível de propósito: o que aparece entre o clique e a
 * gaveta e a página que já estava lá, mais o toast de confirmação. Um
 * esqueleto de gaveta piscando antes da gaveta seria pior que o pequeno
 * atraso que ele tenta disfarcar.
 *
 * ## O estado mora no store
 *
 * Porque quem abre a gaveta esta espalhado pela loja — card da vitrine,
 * seletor rápido, página do produto — e quem a desenha e o layout. Um estado
 * no meio do caminho exigiria um contexto só para isso.
 */
const CartDrawerPanel = lazy(async () => ({
  default: (await import('./cart-drawer-panel')).CartDrawerPanel,
}));

export function CartDrawer() {
  const open = useCart((state) => state.drawerOpen);

  if (!open) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <CartDrawerPanel />
    </Suspense>
  );
}
