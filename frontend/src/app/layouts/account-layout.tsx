import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { StoreFooter, StoreHeader } from '@/components/store';
import { Container, Spinner } from '@/components/ui';
import styles from './account-layout.module.css';

/**
 * O layout da conta do cliente.
 *
 * Tem o seu proprio titulo e a sua coluna lateral — o menu de "meus pedidos",
 * "meus enderecos" e "meus dados" entra no `aside` quando as telas chegarem —
 * mas reaproveita o cabecalho e o rodape da loja de proposito: a conta nao e
 * outro site, e sair dela para continuar comprando tem que ser um clique.
 *
 * O bloqueio de quem nao esta logado nao mora aqui: e um guard de rota, e
 * entra com a tela de login.
 */
export function AccountLayout() {
  return (
    <div className={styles.layout}>
      <StoreHeader />

      <main className={styles.main}>
        <Container>
          <div className={styles.heading}>
            <h1 className={styles.title}>Minha conta</h1>
            <p className={styles.subtitle}>Seus pedidos, enderecos e dados de contato.</p>
          </div>

          <div className={styles.body}>
            {/* O menu da conta entra aqui. */}
            <aside className={styles.aside} />

            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </div>
        </Container>
      </main>

      <StoreFooter />
    </div>
  );
}
