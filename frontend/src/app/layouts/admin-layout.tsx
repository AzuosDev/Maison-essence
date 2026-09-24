import { Suspense, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AdminNav, MenuIcon, SignOutIcon } from '@/components/admin';
import { Drawer, Spinner } from '@/components/ui';
import {
  ROLE_LABELS,
  useAdminSignOut,
  useAdminUser,
  useIsSignedIn,
  useMustChangePassword,
} from '@/features/admin';
import { ThemeIconButton } from '@/features/theme';
import { cx } from '@/lib/cx';
import { useMediaQuery } from '@/lib/use-media-query';
import { ROUTES } from '../routes';
import styles from './admin-layout.module.css';

/**
 * A moldura do painel.
 *
 * Sidebar escura a esquerda, conteudo claro a direita, e nada da loja: o
 * painel e outra aplicacao dentro do mesmo build. Compartilham os tokens e os
 * primitivos, e nada alem disso — a dona precisa saber pelo canto do olho que
 * um clique aqui muda o que o cliente ve.
 *
 * ## O guarda
 *
 * Tres estados, nesta ordem, e a ordem importa:
 *
 * 1. **Sem sessao** — vai para a entrada, guardando de onde veio para
 *    voltar ao mesmo lugar depois do login.
 * 2. **Senha temporaria** — vai para a troca de senha, e nao adianta insistir
 *    em outro endereco: o backend recusa toda rota administrativa enquanto a
 *    marca existir.
 * 3. **Sessao boa** — o painel.
 *
 * O guarda esconde; quem impede e o servidor. Um token adulterado no
 * `localStorage` abriria o menu e receberia 401 na primeira consulta.
 *
 * ## O celular
 *
 * A dona usa o painel no celular na maior parte do tempo. Abaixo de 1024px a
 * coluna vira gaveta, e a barra de cima ganha o botao que a abre. Os dois
 * nunca coexistem no documento: montar o menu duas vezes faria o leitor de
 * tela anunciar oito itens que aparecem uma vez so.
 */

/** A largura em que a coluna fixa cabe ao lado do conteudo. */
const DESKTOP = '(min-width: 64rem)';

export function AdminLayout() {
  const location = useLocation();
  const isDesktop = useMediaQuery(DESKTOP);
  const [menuOpen, setMenuOpen] = useState(false);

  const signedIn = useIsSignedIn();
  const mustChangePassword = useMustChangePassword();
  const user = useAdminUser();
  const signOut = useAdminSignOut();

  if (!signedIn) {
    return <Navigate to={ROUTES.admin.login} replace state={{ from: location.pathname }} />;
  }

  if (mustChangePassword) {
    return <Navigate to={ROUTES.admin.changePassword} replace />;
  }

  const closeMenu = (): void => {
    setMenuOpen(false);
  };

  return (
    <div className={styles.layout}>
      {isDesktop ? (
        <aside className={cx(styles.sidebar, 'on-dark')}>
          <Brand />

          <AdminNav />

          <Footer onSignOut={signOut} />
        </aside>
      ) : null}

      <div className={styles.content}>
        <header className={styles.topbar}>
          {isDesktop ? null : (
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => {
                setMenuOpen(true);
              }}
              aria-label="Abrir o menu do painel"
            >
              <MenuIcon />
            </button>
          )}

          <p className={styles.topbarTitle}>Painel</p>

          {user === null ? null : (
            <p className={styles.user}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
            </p>
          )}
        </header>

        <main className={styles.main}>
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {isDesktop ? null : (
        <Drawer
          open={menuOpen}
          onClose={closeMenu}
          side="left"
          title="Painel"
          className={cx(styles.menuPanel, 'on-dark')}
        >
          <AdminNav onNavigate={closeMenu} />

          <Footer onSignOut={signOut} />
        </Drawer>
      )}
    </div>
  );
}

function Brand() {
  return (
    <p className={styles.brand}>
      Maison
      <span className={styles.brandNote}>Painel</span>
    </p>
  );
}

/**
 * O pe da coluna: sair, e o tema.
 *
 * ## Sair
 *
 * Longe dos itens do menu: e a unica acao da moldura que nao leva a lugar
 * nenhum, e um clique errado nela custa um login inteiro no meio do
 * atendimento.
 *
 * ## O tema
 *
 * Tambem se troca daqui. O controle da loja mora no rodape, e o painel nao
 * tem rodape: sem este, quem opera teria de sair do painel, achar o rodape da
 * loja e voltar. Sao o mesmo estado — trocar aqui muda a marcacao la.
 *
 * Aqui e um icone, e no rodape da loja sao tres segmentos, porque a coluna
 * tem 15rem: a pilula de "Sistema Claro Escuro" nao cabia nela, e o que
 * sobrava era uma barra de rolagem horizontal debaixo do menu. O icone tambem
 * diz melhor o que este lugar e — no pe da coluna moram as duas coisas que
 * nao sao a loja, e nenhuma delas merece o peso de um bloco com titulo.
 *
 * O par divide a linha: o rotulo a esquerda, onde comeca todo item do menu, e
 * o alvo de 44px encostado na direita.
 */
function Footer({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className={styles.footer}>
      <button type="button" className={styles.signOut} onClick={onSignOut}>
        <SignOutIcon className={styles.signOutIcon} />
        Sair
      </button>

      <ThemeIconButton className={styles.theme} />
    </div>
  );
}
