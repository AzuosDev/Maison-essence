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
 * O que o cliente le depois de decidir olhar de perto.
 *
 * Tres abas: o texto do produto, o modo de uso e a politica de trocas. A
 * primeira e do produto; as outras duas sao paginas institucionais, lidas
 * pelo endereco — e essa escolha e o ponto deste arquivo.
 *
 * ## Por que as duas ultimas nao sao texto escrito aqui
 *
 * Politica de trocas e prazo de devolucao mudam, e mudam por motivo legal.
 * Escritas no frontend, cada ajuste de uma virgula viraria uma publicacao —
 * e, pior, a pagina `/institucional/trocas-e-devolucoes` passaria a dizer
 * uma coisa enquanto a aba do produto diz outra. Vindo da mesma rota, ha uma
 * versao so do texto e quem a edita e a dona, no painel.
 *
 * ## A aba so existe quando a pagina existe
 *
 * `useInstitutionalPage` confere a listagem que a moldura da loja ja
 * carregou antes de pedir qualquer coisa: pagina nao publicada nao vira
 * requisicao nem 404, vira aba ausente. O rotulo sai do titulo que a dona
 * escreveu, e nao de uma constante daqui — se ela renomear "Trocas e
 * devolucoes" para "Trocas, devolucoes e garantia", a aba acompanha.
 *
 * ## O modo de uso
 *
 * O backend tem hoje cinco enderecos institucionais fixos, e `modo-de-uso`
 * nao esta entre eles. A aba pergunta por ele mesmo assim e cai em
 * `como-comprar` enquanto ele nao existir: e a pagina que responde a duvida
 * do mesmo momento — o cliente decidiu e quer saber como isso vira pedido.
 * No dia em que `modo-de-uso` for publicado, a aba passa a mostra-lo sem
 * nenhuma linha nova aqui.
 */

/** O endereco que a aba prefere, quando a loja o publicar. */
const USAGE_SLUG = 'modo-de-uso';

interface TabDefinition {
  value: string;
  label: string;
  content: ReactNode;
}

export function ProductTabs({ product }: { product: PublicProductDetail }) {
  const { pages } = useStoreSettings();

  // Tres consultas em ordem fixa: hook nao pode nascer dentro de condicao, e
  // as que apontam para pagina nao publicada ja vem desligadas de dentro.
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
      label: 'Descricao',
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
  // conferencia, um `defaultValue` fixado na montagem deixaria a tela sem
  // painel nenhum quando a primeira aba ainda nao existia.
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
 * A aba de uma pagina institucional, quando ha pagina.
 *
 * O rotulo sai do resumo que a moldura ja tem em maos, e nao da resposta da
 * pagina: assim a aba aparece com o nome certo no primeiro quadro, e so o
 * miolo dela espera a rede. O contrario faria a fila de abas crescer na cara
 * do cliente depois que ele ja tinha comecado a ler.
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

/** O titulo que a dona deu a pagina, ou `null` quando ela nao esta na lista. */
function titleOf(pages: readonly PublicPageSummary[], slug: string): string | null {
  return pages.find((page) => page.slug === slug)?.title ?? null;
}
