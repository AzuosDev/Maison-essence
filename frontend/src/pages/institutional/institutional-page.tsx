import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { MessageScreen } from '@/components/store';
import {
  Breadcrumb,
  Button,
  ButtonLink,
  Container,
  Skeleton,
  SkeletonText,
  type BreadcrumbItem,
} from '@/components/ui';
import {
  useInstitutionalPage,
  useStoreSettings,
  type PublicPageSummary,
} from '@/features/settings';
import { Markdown } from '@/lib/markdown';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './institutional-page.module.css';

/**
 * `/institucional/:slug` — o texto da loja, inteiro.
 *
 * Quem somos, modo de uso, trocas e devoluções, perguntas frequentes: o mesmo
 * conteúdo que a página do produto mostra em aba, aqui lido de ponta a ponta.
 * E a página que responde a quem chegou de busca e ainda não decidiu se
 * confia — o segundo público desta loja —, e e o link que vai para o WhatsApp
 * quando a resposta e grande demais para a conversa.
 *
 * ## Uma coluna de leitura, não uma seção de vitrine
 *
 * A vitrine e densa de propósito: seis linhas por cartão, três fileiras de
 * produto. Aqui o trabalho e outro, e a medida fica presa em 68 caracteres
 * mesmo com 1280px de container. O índice das outras páginas fica na coluna
 * da direita no desktop e depois do texto no celular: ele e saída, não
 * entrada — quem está lendo a política de trocas já chegou onde queria.
 *
 * ## Quatro estados
 *
 * A listagem que a moldura da loja carrega e quem responde "esta página
 * existe?". Enquanto ela não chega (`isUnknown`), a tela mostra esqueleto —
 * nunca "não existe", que seria piscar um 404 em toda visita. Página fora da
 * lista e 404 de verdade, com `noindex`: despublicada, ela não existe para
 * quem está de fora. Falha de rede e outra conversa, e ganha botão de tentar
 * de novo, porque ali tentar resolve.
 */
export default function InstitutionalPage() {
  const { slug = '' } = useParams();
  const { settings, pages } = useStoreSettings();
  const { page, exists, isUnknown, isLoading, isError, retry } = useInstitutionalPage(slug);

  // O título sai da listagem, que a moldura já tem em mãos, e não da resposta
  // da página: assim o cabeçalho nasce escrito e só o texto espera a rede.
  const title = titleOf(pages, slug) ?? page?.title ?? '';

  usePageMeta({
    title: title === '' ? 'Maison Essence' : `${title} — Maison Essence`,
    description: summaryOf(page?.content ?? '', title),
    canonical: `${window.location.origin}${ROUTES.page(slug)}`,
    // Despublicada ou endereço inventado: o Google não guarda o que a loja
    // não publicou. Enquanto a listagem não responde, ninguém sabe ainda.
    ...(isUnknown || exists ? {} : { robots: 'noindex' }),
  });

  if (!isUnknown && !exists) {
    return <PageNotFound />;
  }

  if (isError) {
    return <LoadFailed onRetry={retry} />;
  }

  const waiting = isUnknown || isLoading || page === undefined;
  const others = pages.filter((item) => item.slug !== slug);

  return (
    <Container className={styles.page}>
      <Breadcrumb items={crumbsFor(title)} className={styles.crumbs} />

      <div className={styles.layout}>
        <article className={styles.article}>
          <h1 className={styles.title}>
            {title === '' ? <Skeleton width="14ch" height="0.8em" /> : title}
          </h1>

          {waiting ? (
            <SkeletonText lines={8} className={styles.waiting} />
          ) : page.content.trim() === '' ? (
            // Publicada e ainda sem texto. O painel avisa a dona de que isso
            // acontece; o que esta tela não pode fazer e deixar quem clicou
            // no rodapé diante de um título solto, sem explicação e sem
            // saída.
            <p className={styles.empty}>
              Este texto ainda está sendo escrito. Enquanto isso, a gente responde no WhatsApp.
            </p>
          ) : (
            <Markdown text={page.content} headingLevel={2} className={styles.text} />
          )}

          {waiting || !settings?.whatsappLink ? null : (
            <aside className={styles.help}>
              <p className={styles.helpText}>
                Ficou alguma dúvida? Quem responde é a gente mesmo, uma a uma.
              </p>

              <a href={whatsappHref(settings.whatsappLink, title)} className={styles.helpLink}>
                Falar no WhatsApp
              </a>
            </aside>
          )}
        </article>

        {others.length === 0 ? null : (
          <nav className={styles.side} aria-label="Outras páginas da loja">
            <h2 className={styles.sideTitle}>Também por aqui</h2>

            <ul className={styles.sideList}>
              {others.map((item) => (
                <li key={item.slug}>
                  <Link to={ROUTES.page(item.slug)} className={styles.sideLink}>
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </Container>
  );
}

/* ---- As recusas --------------------------------------------------------- */

function PageNotFound() {
  return (
    <MessageScreen
      code="404"
      title="Esta página não está publicada"
      description="O endereço pode ter mudado, ou este texto ainda está sendo escrito. O que a loja tem a dizer está no rodapé."
      actions={
        <>
          <ButtonLink to={ROUTES.products}>Ver os perfumes</ButtonLink>
          <ButtonLink to={ROUTES.home} variant="secondary">
            Voltar ao início
          </ButtonLink>
        </>
      }
    />
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <MessageScreen
      title="Não foi possível carregar esta página"
      description="A conexão falhou no meio do caminho. O texto continua lá."
      actions={
        <Button
          onClick={() => {
            onRetry();
          }}
        >
          Tentar de novo
        </Button>
      }
    />
  );
}

/* ---- O que a tela precisa saber ----------------------------------------- */

/**
 * O WhatsApp já aberto na dúvida que trouxe a pessoa até aqui.
 *
 * O botão flutuante da loja manda "Vim pelo site e gostaria de saber mais",
 * que serve para quem clicou em qualquer lugar. Aqui se sabe mais: a pessoa
 * estava lendo as trocas, ou o modo de uso — e a dona recebe a conversa já
 * sabendo do que se trata, em vez de perguntar.
 */
function whatsappHref(link: string, title: string): string {
  const message =
    title === ''
      ? 'Olá! Vim pelo site e gostaria de saber mais.'
      : `Olá! Estava lendo "${title}" no site e fiquei com uma dúvida.`;

  return `${link}?text=${encodeURIComponent(message)}`;
}

/** O título que a dona deu a página, ou `null` quando ela não esta na lista. */
function titleOf(pages: readonly PublicPageSummary[], slug: string): string | null {
  return pages.find((page) => page.slug === slug)?.title ?? null;
}

function crumbsFor(title: string): BreadcrumbItem[] {
  const trail: BreadcrumbItem[] = [{ label: 'Início', to: ROUTES.home }];

  // Sem título ainda, o fio de pão para em "Início": um degrau vazio seria
  // uma barra seguida de nada, e ele chega escrito no quadro seguinte.
  if (title !== '') {
    trail.push({ label: title });
  }

  return trail;
}

/** Quanto do texto cabe no cartão de prévia do WhatsApp e do Google. */
const DESCRIPTION_LIMIT = 160;

/**
 * A descrição da prévia, tirada do próprio texto.
 *
 * O primeiro parágrafo de verdade, sem os títulos e sem as marcas do
 * Markdown: o cartão compartilhado no WhatsApp mostra o que a página diz, e
 * não "Trocas e devoluções — Maison Essence" escrito duas vezes. Página ainda
 * carregando cai no texto do título, que e o que se sabe dela.
 */
function summaryOf(content: string, title: string): string {
  const paragraph =
    content
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .find((block) => block !== '' && !block.startsWith('#')) ?? '';

  const plain = paragraph
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain === '') {
    return title === '' ? 'Maison Essence: perfumes importados originais.' : `${title} na Maison Essence.`;
  }

  return plain.length <= DESCRIPTION_LIMIT
    ? plain
    : `${plain.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}
