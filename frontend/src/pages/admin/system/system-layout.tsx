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
 * A moldura da área de sistema.
 *
 * ## Um item de menu, três telas
 *
 * O menu do painel tem oito áreas e não merece uma nona, decima e decima
 * primeira entrada para usuários, auditoria e saúde — são a mesma tarefa
 * ("manter a aplicação") vista de três angulos. Então "Sistema" e um item
 * só, e aqui dentro as três telas são abas.
 *
 * As abas são rotas de verdade, e não estado local: quem esta investigando
 * um incidente precisa poder mandar `/admin/system/auditoria` para outra
 * pessoa, e poder voltar com o botão do navegador.
 *
 * ## O guarda
 *
 * `canManageSystem` decide, e o que ele recusa não e um erro: e uma área que
 * não pertence a quem entrou. Por isso a tela de acesso negado fica **dentro**
 * da moldura do painel, com o menu ao lado — quem tropecou aqui digitando a
 * URL continua a um clique de onde queria ir. Um `throw` ou um redirecionamento
 * para a home dariam a mesma proteção e tratariam a dona da loja como
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
          Quem entra no painel, o que foi feito nele e como o servidor esta. Visível só para{' '}
          {ROLE_LABELS.SUPER_ADMIN.toLowerCase()}.
        </p>
      </header>

      <nav aria-label="Telas do sistema">
        <ul className={styles.tabs}>
          <li>
            <NavLink to={ROUTES.admin.system} end className={tabClass}>
              <UsersIcon className={styles.tabIcon} />
              Usuários
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
              Saúde
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
