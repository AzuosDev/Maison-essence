import { Suspense, useRef } from 'react';
import { Outlet, ScrollRestoration, type Location } from 'react-router-dom';
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
        <WhatsappButton avoidRef={footerRef} />
      </div>
    </StoreSettingsProvider>
  );
}

/**
 * A chave sob a qual cada posicao de rolagem e guardada.
 *
 * O padrao do React Router e `location.key`, que e unico por navegacao —
 * inclusive por `replace`. Aqui a chave e so o caminho, e a diferenca importa
 * em dois momentos da vitrine:
 *
 * 1. **Marcar um filtro nao pula para o topo.** Os filtros vivem na query
 *    string e cada clique reescreve a URL. Com a chave padrao, cada reescrita
 *    seria um endereco novo, e o navegador iria para o inicio da pagina — o
 *    cliente marcaria "em estoque" na barra lateral e perderia o lugar em que
 *    estava. Com o caminho como chave, `/produtos` e `/produtos?estoque=1`
 *    compartilham a posicao e a tela fica parada.
 * 2. **Voltar do produto cai onde se estava.** A ida para `/produtos/asad`
 *    grava a altura de `/produtos`; a volta a encontra. E a metade desta casa
 *    do criterio de aceite — a outra metade e a lista ainda estar em cache,
 *    para que exista altura onde pousar.
 */
function scrollKey(location: Location): string {
  return location.pathname;
}
