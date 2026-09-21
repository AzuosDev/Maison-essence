import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { StoreFooter, StoreHeader } from '@/components/store';
import { Spinner } from '@/components/ui';
import styles from './store-layout.module.css';

/**
 * O layout da loja publica.
 *
 * O `Suspense` fica aqui, em volta do `Outlet`, e nao em volta do router
 * inteiro: e o que faz a troca de pagina mostrar o carregamento no miolo,
 * com o cabecalho e o rodape parados no lugar. Sem ele, cada rota carregada
 * sob demanda apagaria a tela toda por um instante.
 */
export function StoreLayout() {
  return (
    <div className={styles.layout}>
      <StoreHeader />

      <main className={styles.main}>
        <Suspense fallback={<Spinner page />}>
          <Outlet />
        </Suspense>
      </main>

      <StoreFooter />
    </div>
  );
}
