import { Suspense, useRef } from 'react';
import { Outlet, ScrollRestoration, type Location } from 'react-router-dom';
import {
  AnnouncementBar,
  CartDrawer,
  StoreFooter,
  StoreHeader,
  WhatsappButton,
} from '@/components/store';
import { Spinner } from '@/components/ui';
import { StoreSettingsProvider } from '@/features/settings';
import styles from './store-layout.module.css';

/**
 * A moldura da loja publica.
 *
 * O `StoreSettingsProvider` fica no topo e busca `GET /settings` e
 * `GET /pages` uma vez. Barra de avisos, cabeçalho, rodapé e o botão do
 * WhatsApp leem do contexto — nenhum deles chama a API por conta própria.
 *
 * O `Suspense` envolve o `Outlet`, e não o router inteiro: a troca de página
 * mostra o carregamento no miolo, com o cabeçalho e o rodapé parados no
 * lugar. Sem ele, cada rota carregada sob demanda apagaria a tela toda por
 * um instante.
 *
 * O `ref` do rodapé existe por causa do botão do WhatsApp: e por ele que o
 * botão sabe quando o rodapé entrou na tela e sobe para não cobrir os links.
 */
export function StoreLayout() {
  const footerRef = useRef<HTMLElement>(null);

  return (
    <StoreSettingsProvider>
      <ScrollRestoration getKey={scrollKey} />

      <div className={styles.layout}>
        <AnnouncementBar />
        <StoreHeader />

        <main className={styles.main}>
          <Suspense fallback={<Spinner page />}>
            <Outlet />
          </Suspense>
        </main>

        <StoreFooter ref={footerRef} />

        {/* A gaveta da sacola vive aqui porque quem a abre esta em toda a
            loja — card, seletor rápido, página do produto — e o estado dela
            mora no store do carrinho. Fechada, não monta nada. */}
        <CartDrawer />
        <WhatsappButton avoidRef={footerRef} />
      </div>
    </StoreSettingsProvider>
  );
}

/**
 * A chave sob a qual cada posição de rolagem e guardada.
 *
 * O padrão do React Router e `location.key`, que e único por navegação —
 * inclusive por `replace`. Aqui a chave e só o caminho, e a diferença importa
 * em dois momentos da vitrine:
 *
 * 1. **Marcar um filtro não pula para o topo.** Os filtros vivem na query
 *    string e cada clique reescreve a URL. Com a chave padrão, cada reescrita
 *    seria um endereço novo, e o navegador iria para o início da página — o
 *    cliente marcaria "em estoque" na barra lateral e perderia o lugar em que
 *    estava. Com o caminho como chave, `/produtos` e `/produtos?estoque=1`
 *    compartilham a posição e a tela fica parada.
 * 2. **Voltar do produto cai onde se estava.** A ida para `/produtos/asad`
 *    grava a altura de `/produtos`; a volta a encontra. E a metade desta casa
 *    do critério de aceite — a outra metade e a lista ainda estar em cache,
 *    para que exista altura onde pousar.
 */
function scrollKey(location: Location): string {
  return location.pathname;
}
