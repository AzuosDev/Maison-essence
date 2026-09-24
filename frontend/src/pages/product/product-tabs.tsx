import { useState, type ReactNode } from 'react';
import { SkeletonText, Tab, TabList, TabPanel, Tabs } from '@/components/ui';
import type { PublicProductDetail } from '@/features/catalog';
import {
  INSTITUTIONAL_PAGE_SLUGS,
  useInstitutionalPage,
  useStoreSettings,
  type InstitutionalPageQuery,
  type PublicPageSummary,
} from '@/features/settings';
import { Markdown } from '@/lib/markdown';
import styles from './product-tabs.module.css';

/**
 * O que o cliente lê depois de decidir olhar de perto.
 *
 * Três abas: o texto do produto, o modo de uso e a política de trocas. A
 * primeira e do produto; as outras duas são páginas institucionais, lidas
 * pelo endereço — e essa escolha e o ponto deste arquivo.
 *
 * ## Por que as duas últimas não são texto escrito aqui
 *
 * Política de trocas e prazo de devolução mudam, e mudam por motivo legal.
 * Escritas no frontend, cada ajuste de uma vírgula viraria uma publicação —
 * e, pior, a página `/institucional/trocas-e-devolucoes` passaria a dizer
 * uma coisa enquanto a aba do produto diz outra. Vindo da mesma rota, há uma
 * versão só do texto e quem a edita e a dona, no painel.
 *
 * ## A aba só existe quando a página existe
 *
 * `useInstitutionalPage` confere a listagem que a moldura da loja já
 * carregou antes de pedir qualquer coisa: página não publicada não vira
 * requisição nem 404, vira aba ausente. O rótulo sai do título que a dona
 * escreveu, e não de uma constante daqui — se ela renomear "Trocas e
 * devoluções" para "Trocas, devoluções e garantia", a aba acompanha.
 *
 * ## O modo de uso
 *
 * O backend tem hoje cinco endereços institucionais fixos, e `modo-de-uso`
 * não esta entre eles. A aba pergunta por ele mesmo assim e cai em
 * `como-comprar` enquanto ele não existir: e a página que responde a dúvida
 * do mesmo momento — o cliente decidiu e quer saber como isso vira pedido.
 * No dia em que `modo-de-uso` for publicado, a aba passa a mostra-lo sem
 * nenhuma linha nova aqui.
 */

/** O endereço que a aba prefere, quando a loja o publicar. */
const USAGE_SLUG = 'modo-de-uso';

interface TabDefinition {
  value: string;
  label: string;
  content: ReactNode;
}

export function ProductTabs({ product }: { product: PublicProductDetail }) {
  const { pages } = useStoreSettings();

  // Três consultas em ordem fixa: hook não pode nascer dentro de condição, e
  // as que apontam para página não publicada já vem desligadas de dentro.
  const usage = useInstitutionalPage(USAGE_SLUG);
  const howToBuy = useInstitutionalPage(INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY);
  const returns = useInstitutionalPage(INSTITUTIONAL_PAGE_SLUGS.RETURNS);

  const instructions = usage.exists ? usage : howToBuy;
  const instructionsSlug = usage.exists ? USAGE_SLUG : INSTITUTIONAL_PAGE_SLUGS.HOW_TO_BUY;

  const [chosen, setChosen] = useState('');

  const tabs: TabDefinition[] = [];

  if (product.description.trim() !== '') {
    tabs.push({
      value: 'descricao',
      label: 'Descrição',
      content: <Markdown text={product.description} headingLevel={3} className={styles.prose} />,
    });
  }

  pushPageTab(tabs, 'modo-de-uso', instructionsSlug, instructions, pages);
  pushPageTab(tabs, 'trocas', INSTITUTIONAL_PAGE_SLUGS.RETURNS, returns, pages);

  if (tabs.length === 0) {
    return null;
  }

  // A aba escolhida vale enquanto ela existir. As institucionais chegam
  // depois do produto, e a lista pode crescer debaixo da escolha; sem esta
  // conferência, um `defaultValue` fixado na montagem deixaria a tela sem
  // painel nenhum quando a primeira aba ainda não existia.
  const active = tabs.some((tab) => tab.value === chosen) ? chosen : (tabs[0]?.value ?? '');

  return (
    <section className={styles.block} aria-label="Sobre o produto">
      <Tabs value={active} onChange={setChosen}>
        <TabList aria-label="Sobre o produto" className={styles.list}>
          {tabs.map((tab) => (
            <Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tab>
          ))}
        </TabList>

        {tabs.map((tab) => (
          <TabPanel key={tab.value} value={tab.value} className={styles.panel}>
            {tab.content}
          </TabPanel>
        ))}
      </Tabs>
    </section>
  );
}

/**
 * A aba de uma página institucional, quando há página.
 *
 * O rótulo sai do resumo que a moldura já tem em mãos, e não da resposta da
 * página: assim a aba aparece com o nome certo no primeiro quadro, e só o
 * miolo dela espera a rede. O contrário faria a fila de abas crescer na cara
 * do cliente depois que ele já tinha comecado a ler.
 */
function pushPageTab(
  tabs: TabDefinition[],
  value: string,
  slug: string,
  query: InstitutionalPageQuery,
  pages: readonly PublicPageSummary[],
): void {
  if (!query.exists) {
    return;
  }

  const label = titleOf(pages, slug);

  if (label === null) {
    return;
  }

  tabs.push({
    value,
    label,
    content: query.isLoading ? (
      <SkeletonText lines={4} />
    ) : (
      <Markdown text={query.page?.content ?? ''} headingLevel={3} className={styles.prose} />
    ),
  });
}

/** O título que a dona deu a página, ou `null` quando ela não esta na lista. */
function titleOf(pages: readonly PublicPageSummary[], slug: string): string | null {
  return pages.find((page) => page.slug === slug)?.title ?? null;
}
