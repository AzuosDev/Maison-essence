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
 * Reaproveita a loja inteira de proposito — mesmo cabecalho, mesmo rodape,
 * mesmo creme de fundo. A conta nao e outro site, e sair dela para continuar
 * comprando tem que ser um clique.
 *
 * ## A moldura muda conforme haja sessao, e a diferenca importa
 *
 * **Com sessao**: a saudacao com o nome, o telefone que identifica a conta e
 * o menu lateral.
 *
 * **Sem sessao**: nada disso. Nenhuma saudacao, nenhum menu. Um menu de
 * "meus pedidos / enderecos / meus dados" ao lado de um formulario de
 * entrada seria um menu de mentira — tres links que nao levam a lugar
 * nenhum, e que insinuam que existe algo trancado atras deles.
 *
 * ## Aqui nao ha guarda de rota
 *
 * E a decisao central desta area. Quem abre `/conta/pedidos` sem sessao
 * **continua em `/conta/pedidos`**, e a tela mostra o convite. Um
 * `<Navigate to="/conta/entrar">` nesta moldura seria a parede de login que
 * o projeto nao quer: trocaria o endereco que a pessoa escolheu por um
 * formulario que ela nao pediu, e o "voltar" do navegador a jogaria de volta
 * no mesmo lugar.
 *
 * ## A gaveta da sacola mora aqui tambem
 *
 * Nao e simetria com o layout da loja: e necessidade. O botao "pedir
 * novamente", no detalhe do pedido, poe itens na sacola e abre a gaveta —
 * sem ela montada nesta moldura, o clique funcionaria em silencio e a pessoa
 * ficaria olhando para a mesma tela.
 */
export function AccountLayout() {
  const footerRef = useRef<HTMLElement>(null);
  const customer = useCustomer();

  return (
    <StoreSettingsProvider>
      {/*
        Sem `getKey`: ao contrario da vitrine, aqui nao ha filtro reescrevendo
        a URL. Cada navegacao e uma tela nova e deve comecar do topo — abrir
        um pedido a partir do fim da lista nao pode cair no meio do detalhe.
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
 * So o primeiro nome na saudacao.
 *
 * "Ola, Maria" e o que uma vendedora diria; "Ola, Maria Aparecida Souza da
 * Silva" e o que um sistema diria. O nome completo continua na tela de
 * dados, que e onde ele e conferido.
 */
function firstName(name: string): string {
  return name.trim().split(' ')[0] ?? name;
}
