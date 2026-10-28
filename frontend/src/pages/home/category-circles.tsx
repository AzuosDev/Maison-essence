import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Container, Skeleton } from '@/components/ui';
import { useCategoryTree, type CategoryTree } from '@/features/catalog';
import { imageProps } from '@/lib/cloudinary';
import styles from './category-circles.module.css';

/**
 * A fileira de categorias em círculo, logo abaixo do banner.
 *
 * E o primeiro caminho de quem chegou sem saber o que quer, e ele vem antes
 * de qualquer produto de propósito: quem abre a loja pelo anúncio não tem um
 * perfume em mente, tem uma intenção — "masculino", "pronta entrega",
 * "corpo" — e a fileira responde a intenção com um toque.
 *
 * ## Nove, e redondas
 *
 * Nove porque e quanto cabe numa fileira de desktop sem encolher o círculo
 * abaixo de 88px, que e o ponto em que a foto dentro dele deixa de ser
 * reconhecível. A arvore inteira continua no menu e no painel de categorias.
 *
 * O círculo não e enfeite: ele e o que permite que fotos de proporções
 * diferentes — um frasco em retrato, um kit em paisagem — convivam na mesma
 * fileira sem nenhuma parecer cortada. Com cartões retangulares, o recorte
 * de cada foto vira um problema por categoria.
 *
 * ## No celular ela rola
 *
 * Nove círculos de 88px não cabem em 390px, e espremer nove em duas fileiras
 * de quatro e meia empurra o primeiro produto para fora da primeira tela. A
 * fileira rola na horizontal, com o encaixe do navegador, do mesmo jeito que
 * as prateleiras de produto — um gesto só para aprender na página inteira.
 */
const MAX_CATEGORIES = 9;

export function CategoryCircles() {
  const { data, isLoading, isError } = useCategoryTree();

  const categories = (data ?? []).slice(0, MAX_CATEGORIES);

  // Erro aqui não vira mensagem: a fileira e um atalho, e o menu do
  // cabeçalho leva aos mesmos lugares. Uma faixa de erro acima da vitrine
  // alarmaria o cliente por uma navegação que ele nem tentou usar.
  if (isError || (!isLoading && categories.length === 0)) {
    return null;
  }

  return (
    <nav className={styles.strip} aria-label="Categorias" aria-busy={isLoading || undefined}>
      <Container className={styles.inner}>
        <ul className={styles.list}>
          {isLoading
            ? Array.from({ length: MAX_CATEGORIES }, (_, index) => (
                <li key={index} className={styles.item}>
                  <Skeleton className={styles.circle} />
                  <Skeleton width="4.5rem" height="0.75rem" />
                </li>
              ))
            : categories.map((category) => (
                <li key={category.id} className={styles.item}>
                  <CategoryCircle category={category} />
                </li>
              ))}
        </ul>
      </Container>
    </nav>
  );
}

function CategoryCircle({ category }: { category: CategoryTree }) {
  /*
   * A foto não chegou — e as três maneiras de isso acontecer importam.
   *
   * A primeira e a dona não ter cadastrado foto para a categoria, que e
   * campo opcional no painel. A segunda, mais traicoeira, e a foto existir
   * no cadastro e não carregar: identificador trocado no Cloudinary, arquivo
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
  const hasImage = category.image !== '' && !failed;

  return (
    <Link to={ROUTES.category(category.slug)} className={styles.link}>
      <span className={styles.circle}>
        {/* Decorativa para quem ouve a página: o nome vem escrito logo
            abaixo, e anunciar "P" antes de "Perfumes Masculinos" só
            atrapalha. */}
        <span className={styles.initial} aria-hidden="true">
          {initialOf(category.name)}
        </span>

        {hasImage ? (
          <img
            {...imageProps(category.image, 'thumb', '112px')}
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
             * a primeira rolagem. Era isso que deixava uma categoria em
             * branco na abertura enquanto as vizinhas apareciam.
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

      <span className={styles.name}>{category.name}</span>
    </Link>
  );
}

/** A primeira letra, em caixa alta. Vazio quando o nome também esta vazio. */
function initialOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}
