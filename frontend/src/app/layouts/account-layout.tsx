import { Suspense, useRef } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { AccountNav } from '@/components/account';
import {
  AnnouncementBar,
  CartDrawer,
  StoreFooter,
  StoreHeader,
  WhatsappButton,
} from '@/components/store';
import { Container, Spinner } from '@/components/ui';
import { useCustomer } from '@/features/account';
import { StoreSettingsProvider } from '@/features/settings';
import styles from './account-layout.module.css';

/**
 * A moldura da conta do cliente.
 *
 * Reaproveita a loja inteira de propósito — mesmo cabeçalho, mesmo rodapé,
 * mesmo creme de fundo. A conta não e outro site, e sair dela para continuar
 * comprando tem que ser um clique.
 *
 * ## A moldura muda conforme haja sessão, e a diferença importa
 *
 * **Com sessão**: a saudação com o nome, o telefone que identifica a conta e
 * o menu lateral.
 *
 * **Sem sessão**: nada disso. Nenhuma saudação, nenhum menu. Um menu de
 * "meus pedidos / endereços / meus dados" ao lado de um formulário de
 * entrada seria um menu de mentira — três links que não levam a lugar
 * nenhum, e que insinuam que existe algo trancado atrás deles.
 *
 * ## Aqui não há guarda de rota
 *
 * E a decisão central desta área. Quem abre `/conta/pedidos` sem sessão
 * **continua em `/conta/pedidos`**, e a tela mostra o convite. Um
 * `<Navigate to="/conta/entrar">` nesta moldura seria a parede de login que
 * o projeto não quer: trocaria o endereço que a pessoa escolheu por um
 * formulário que ela não pediu, e o "voltar" do navegador a jogaria de volta
 * no mesmo lugar.
 *
 * ## A gaveta da sacola mora aqui também
 *
 * Não e simetria com o layout da loja: e necessidade. O botão "pedir
 * novamente", no detalhe do pedido, põe itens na sacola e abre a gaveta —
 * sem ela montada nesta moldura, o clique funcionaria em silêncio e a pessoa
 * ficaria olhando para a mesma tela.
 */
export function AccountLayout() {
  const footerRef = useRef<HTMLElement>(null);
  const customer = useCustomer();

  return (
    <StoreSettingsProvider>
      {/*
        Sem `getKey`: ao contrário da vitrine, aqui não há filtro reescrevendo
        a URL. Cada navegação e uma tela nova e deve começar do topo — abrir
        um pedido a partir do fim da lista não pode cair no meio do detalhe.
      */}
      <ScrollRestoration />

      <div className={styles.layout}>
        <AnnouncementBar />
        <StoreHeader />

        <main className={styles.main}>
          <Container>
            {customer === null ? null : (
              <div className={styles.heading}>
                <p className={styles.greeting}>Olá, {firstName(customer.name)}</p>
                <p className={styles.subtitle}>
                  Sua conta esta ligada ao telefone {customer.phoneLabel}.
                </p>
              </div>
            )}

            <div className={styles.body}>
              {customer === null ? null : (
                <aside className={styles.aside}>
                  <AccountNav />
                </aside>
              )}

              <Suspense fallback={<Spinner />}>
                <Outlet />
              </Suspense>
            </div>
          </Container>
        </main>

        <StoreFooter ref={footerRef} />

        <CartDrawer />
        <WhatsappButton avoidRef={footerRef} />
      </div>
    </StoreSettingsProvider>
  );
}

/**
 * Só o primeiro nome na saudação.
 *
 * "Olá, Maria" e o que uma vendedora diria; "Olá, Maria Aparecida Souza da
 * Silva" e o que um sistema diria. O nome completo continua na tela de
 * dados, que e onde ele e conferido.
 */
function firstName(name: string): string {
  return name.trim().split(' ')[0] ?? name;
}
