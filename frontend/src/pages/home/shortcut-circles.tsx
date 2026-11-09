import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container, Skeleton } from '@/components/ui';
import { useCategoryTree } from '@/features/catalog';
import { useStoreSettings } from '@/features/settings';
import { imageProps } from '@/lib/cloudinary';
import styles from './shortcut-circles.module.css';

/**
 * A fileira de atalhos em círculo, logo abaixo do banner.
 *
 * E o primeiro caminho de quem chegou sem saber o que quer, e ele vem antes
 * de qualquer produto de propósito: quem abre a loja pelo anúncio não tem um
 * perfume em mente, tem uma intenção — "masculino", "mais vendidos", "corpo"
 * — e a fileira responde a intenção com um toque.
 *
 * ## De onde sai a lista, e por que ela deixou de ser a arvore
 *
 * Da fileira que a dona monta no painel, em Ajustes: nome, foto e destino de
 * cada círculo. Até aqui esta fileira era, literalmente, as categorias-raiz
 * do catálogo na ordem do painel — e isso amarrava duas decisões diferentes
 * num campo só. Pôr "Mais vendidos" na primeira tela exigia inventar uma
 * categoria vazia; destacar uma marca exigia transformar a marca em
 * categoria e reclassificar sessenta produtos. A arvore voltou a ser o que
 * ela e, a organização do catálogo, e segue mandando no menu.
 *
 * **Sem nenhum atalho cadastrado a fileira cai nas categorias-raiz**, que e
 * o que ela sempre fez. Não e tolerância a configuração pela metade: e o que
 * garante que a loja nunca perde a primeira navegação da página por causa de
 * uma lista que ninguém preencheu ainda — e e o que faz esta troca não
 * apagar a fileira de nenhuma loja no dia do deploy.
 *
 * ## Nove, e redondas
 *
 * Nove porque e quanto cabe numa fileira de desktop sem encolher o círculo
 * abaixo de 88px, que e o ponto em que a foto dentro dele deixa de ser
 * reconhecível.
 *
 * O círculo não e enfeite: ele e a forma comum que faz sete artes diferentes
 * conviverem na mesma fileira sem nenhuma parecer recortada. E ele não corta
 * a arte — o disco colorido que a arte traz e desenhado na medida exata do
 * círculo, e o produto que passa do disco aparece por fora, solto sobre a
 * página. O enquadramento esta em `shortcut-circles.module.css`, e o que o
 * garante no envio em `backend/scripts/shortcuts/art.ts`.
 *
 * ## No celular ela rola
 *
 * Nove círculos de 88px não cabem em 390px, e espremer nove em duas fileiras
 * de quatro e meia empurra o primeiro produto para fora da primeira tela. A
 * fileira rola na horizontal, com o encaixe do navegador, do mesmo jeito que
 * as prateleiras de produto — um gesto só para aprender na página inteira.
 */
const MAX_CIRCLES = 9;

/** Um círculo da fileira, venha ele da lista da dona ou da arvore. */
interface Circle {
  key: string;
  label: string;
  /** `publicId` do Cloudinary. Vazio deixa o círculo na inicial do nome. */
  image: string;
  to: string;
}

export function ShortcutCircles() {
  const { settings, isLoading: areSettingsLoading } = useStoreSettings();

  /*
   * A arvore e pedida sempre, e não só quando a fileira esta vazia.
   *
   * Chamar o hook condicionalmente não e possível, e nem seria desejável: a
   * mesma consulta já e feita pelos cartazes de coleção mais abaixo nesta
   * página, então ela sai uma vez e as duas seções leem a mesma resposta do
   * cache. Pedi-la aqui não custa requisição nenhuma.
   */
  const { data: categories, isLoading: areCategoriesLoading } = useCategoryTree();

  const shortcuts = settings?.shortcuts ?? [];
  const usesShortcuts = shortcuts.length > 0;

  const circles: Circle[] = (
    usesShortcuts
      ? shortcuts.map((shortcut) => ({
          key: shortcut.id,
          label: shortcut.label,
          image: shortcut.image,
          to: shortcut.link,
        }))
      : (categories ?? []).map((category) => ({
          key: category.id,
          label: category.name,
          image: category.image,
          to: ROUTES.category(category.slug),
        }))
  ).slice(0, MAX_CIRCLES);

  /*
   * O esqueleto some assim que as configurações chegam com fileira montada.
   *
   * Enquanto elas não chegaram não da para saber qual das duas listas vale, e
   * desenhar a arvore nesse intervalo faria a fileira trocar de conteúdo
   * diante da cliente. Com a fileira montada, a arvore deixa de importar e a
   * espera dela não pode segurar nada.
   */
  const isLoading = areSettingsLoading || (!usesShortcuts && areCategoriesLoading);

  // Fileira vazia não vira mensagem: ela e um atalho, e o menu do cabeçalho
  // leva aos mesmos lugares. Uma faixa de erro acima da vitrine alarmaria o
  // cliente por uma navegação que ele nem tentou usar.
  if (!isLoading && circles.length === 0) {
    return null;
  }

  return (
    <nav className={styles.strip} aria-label="Atalhos da loja" aria-busy={isLoading || undefined}>
      <Container className={styles.inner}>
        <ul className={styles.list}>
          {isLoading
            ? Array.from({ length: MAX_CIRCLES }, (_, index) => (
                <li key={index} className={styles.item}>
                  <Skeleton className={styles.circle} />
                  <Skeleton width="4.5rem" height="0.75rem" />
                </li>
              ))
            : circles.map((circle) => (
                <li key={circle.key} className={styles.item}>
                  <ShortcutCircle circle={circle} />
                </li>
              ))}
        </ul>
      </Container>
    </nav>
  );
}

function ShortcutCircle({ circle }: { circle: Circle }) {
  /*
   * A foto não chegou — e as três maneiras de isso acontecer importam.
   *
   * A primeira e a dona não ter cadastrado foto para o atalho, que e campo
   * opcional no painel. A segunda, mais traicoeira, e a foto existir no
   * cadastro e não carregar: identificador trocado no Cloudinary, arquivo
   * removido, rede que caiu no meio — nesse caso o `<img>` fica no DOM como
   * um retângulo vazio, e nenhuma checagem de `image === ''` percebe. A
   * terceira e a mais comum de todas: a foto vai chegar, só não chegou
   * ainda.
   *
   * As três terminavam no mesmo lugar: um disco branco, mudo, na segunda
   * ação da primeira tela. Isso não lê como "carregando" — lê como loja pela
   * metade.
   *
   * Por isso a inicial não e alternativa da foto: ela e o fundo do círculo,
   * sempre presente, e a foto entra por cima quando decodifica. Não há
   * instante em que o círculo esteja vazio, e o caso que o `onError` cobre —
   * a foto que falhou de verdade — passa a ser só o que ele sempre foi: tirar
   * do caminho um `<img>` que não vai pintar nunca.
   */
  const [failed, setFailed] = useState(false);
  const hasImage = circle.image !== '' && !failed;

  return (
    <Link to={circle.to} className={styles.link}>
      <span className={styles.circle}>
        {/* Decorativa para quem ouve a página: o nome vem escrito logo
            abaixo, e anunciar "P" antes de "Perfumes Masculinos" só
            atrapalha. */}
        <span className={styles.initial} aria-hidden="true">
          {initialOf(circle.label)}
        </span>

        {hasImage ? (
          // `124px` e o lado do quadrado da arte no desktop, e não o diâmetro
          // do círculo: ela e desenhada maior que ele de propósito.
          <img
            {...imageProps(circle.image, 'thumb', '124px')}
            alt=""
            className={styles.image}
            width={224}
            height={224}
            /*
             * Sem `lazy`, e de propósito.
             *
             * Os nove círculos estão na primeira dobra do desktop, logo
             * abaixo do banner — e `lazy` numa imagem que o navegador julga
             * fora da tela por uma dezena de pixels adia o carregamento até
             * a primeira rolagem. Era isso que deixava um círculo em branco
             * na abertura enquanto os vizinhos apareciam.
             *
             * `eager` sem `fetchPriority: high`: eles precisam começar, não
             * precisam ganhar da foto do banner. São nove miniaturas de
             * 112px — juntas pesam menos que a imagem que elas não devem
             * atrasar.
             */
            loading="eager"
            decoding="async"
            onError={() => {
              setFailed(true);
            }}
          />
        ) : null}
      </span>

      <span className={styles.name}>{circle.label}</span>
    </Link>
  );
}

/** A primeira letra, em caixa alta. Vazio quando o nome também esta vazio. */
function initialOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}
