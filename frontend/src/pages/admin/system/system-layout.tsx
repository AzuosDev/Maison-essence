import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { HistoryIcon, PulseIcon, UsersIcon } from '@/components/admin';
import { Spinner } from '@/components/ui';
import { ROLE_LABELS, canManageSystem, useAdminRole } from '@/features/admin';
import { cx } from '@/lib/cx';
import { usePageMeta } from '@/lib/use-page-meta';
import { AccessDenied } from './access-denied';
import styles from './system-layout.module.css';

/**
 * A moldura da area de sistema.
 *
 * ## Um item de menu, tres telas
 *
 * O menu do painel tem oito areas e nao merece uma nona, decima e decima
 * primeira entrada para usuarios, auditoria e saude — sao a mesma tarefa
 * ("manter a aplicacao") vista de tres angulos. Entao "Sistema" e um item
 * so, e aqui dentro as tres telas sao abas.
 *
 * As abas sao rotas de verdade, e nao estado local: quem esta investigando
 * um incidente precisa poder mandar `/admin/system/auditoria` para outra
 * pessoa, e poder voltar com o botao do navegador.
 *
 * ## O guarda
 *
 * `canManageSystem` decide, e o que ele recusa nao e um erro: e uma area que
 * nao pertence a quem entrou. Por isso a tela de acesso negado fica **dentro**
 * da moldura do painel, com o menu ao lado — quem tropecou aqui digitando a
 * URL continua a um clique de onde queria ir. Um `throw` ou um redirecionamento
 * para a home dariam a mesma protecao e tratariam a dona da loja como
 * intrusa.
 *
 * O guarda esconde; quem impede e o servidor, com `@Roles(...)` em cada
 * controlador.
 */
export default function SystemLayout() {
  const role = useAdminRole();

  usePageMeta({ title: 'Sistema — Painel Maison Essence', description: 'Acesso restrito.' });

  if (!canManageSystem(role)) {
    return <AccessDenied role={role} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sistema</h1>

        <p className={styles.subtitle}>
          Quem entra no painel, o que foi feito nele e como o servidor esta. Visivel so para{' '}
          {ROLE_LABELS.SUPER_ADMIN.toLowerCase()}.
        </p>
      </header>

      <nav aria-label="Telas do sistema">
        <ul className={styles.tabs}>
          <li>
            <NavLink to={ROUTES.admin.system} end className={tabClass}>
              <UsersIcon className={styles.tabIcon} />
              Usuarios
            </NavLink>
          </li>

          <li>
            <NavLink to={ROUTES.admin.systemAudit} className={tabClass}>
              <HistoryIcon className={styles.tabIcon} />
              Auditoria
            </NavLink>
          </li>

          <li>
            <NavLink to={ROUTES.admin.systemHealth} className={tabClass}>
              <PulseIcon className={styles.tabIcon} />
              Saude
            </NavLink>
          </li>
        </ul>
      </nav>

      <Suspense fallback={<Spinner />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

/** O `NavLink` marca `aria-current="page"` sozinho; a classe cuida da cor. */
function tabClass({ isActive }: { isActive: boolean }): string {
  return cx(styles.tab, isActive && styles.tabActive);
}
