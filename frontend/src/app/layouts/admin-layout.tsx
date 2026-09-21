import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import styles from './admin-layout.module.css';

/**
 * O layout do painel.
 *
 * Sidebar e topbar proprias, sem nada da loja: o painel e outra aplicacao
 * dentro do mesmo build. Compartilham os tokens e os primitivos, e nada alem
 * disso.
 *
 * A sidebar some abaixo de 1024px — o painel e feito para tela grande, e o
 * menu do celular entra como gaveta quando as telas chegarem. O controle de
 * papel (`SUPER_ADMIN`, `OWNER`, `STAFF`) tambem: e guard de rota, nao
 * layout.
 */
export function AdminLayout() {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <p className={styles.brand}>
          Maison
          <span className={styles.brandNote}>Painel</span>
        </p>

        {/* O menu do painel entra aqui. */}
        <nav />
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <p className={styles.topbarTitle}>Painel administrativo</p>

          {/* Usuario logado e sair entram aqui. */}
          <div />
        </header>

        <main className={styles.main}>
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
