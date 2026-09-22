import { Suspense, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { AnnouncementBar, StoreFooter, StoreHeader, WhatsappButton } from '@/components/store';
import { Spinner } from '@/components/ui';
import { StoreSettingsProvider } from '@/features/settings';
import styles from './store-layout.module.css';

/**
 * A moldura da loja publica.
 *
 * O `StoreSettingsProvider` fica no topo e busca `GET /settings` e
 * `GET /pages` uma vez. Barra de avisos, cabecalho, rodape e o botao do
 * WhatsApp leem do contexto — nenhum deles chama a API por conta propria.
 *
 * O `Suspense` envolve o `Outlet`, e nao o router inteiro: a troca de pagina
 * mostra o carregamento no miolo, com o cabecalho e o rodape parados no
 * lugar. Sem ele, cada rota carregada sob demanda apagaria a tela toda por
 * um instante.
 *
 * O `ref` do rodape existe por causa do botao do WhatsApp: e por ele que o
 * botao sabe quando o rodape entrou na tela e sobe para nao cobrir os links.
 */
export function StoreLayout() {
  const footerRef = useRef<HTMLElement>(null);

  return (
    <StoreSettingsProvider>
      <div className={styles.layout}>
        <AnnouncementBar />
        <StoreHeader />

        <main className={styles.main}>
          <Suspense fallback={<Spinner page />}>
            <Outlet />
          </Suspense>
        </main>

        <StoreFooter ref={footerRef} />
        <WhatsappButton avoidRef={footerRef} />
      </div>
    </StoreSettingsProvider>
  );
}
