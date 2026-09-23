import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '@/components/ui';
import type { PublicProduct } from '@/features/catalog';
import { cx } from '@/lib/cx';
import { ProductCard } from './product-card';
import { ProductCardSkeleton } from './product-card-skeleton';
import { SectionHeading } from './section-heading';
import styles from './product-shelf.module.css';

interface ProductShelfProps {
  title: string;
  description?: string | undefined;
  products: PublicProduct[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  to?: string | undefined;
  linkLabel?: string;
  skeletonCount?: number;
  tinted?: boolean;
  /** Sem respiro em cima: a prateleira encosta no que vem antes dela. */
  flush?: boolean;
  className?: string | undefined;
}

const DEFAULT_SKELETON_COUNT = 8;

/**
 * O que a prateleira precisa saber para decidir se existe.
 */
export interface ShelfContent {
  products: PublicProduct[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Esta prateleira vai desenhar alguma coisa?
 *
 * Prateleira sem produto nao vira secao vazia: some. Carregando ainda vale,
 * porque os esqueletos ja ocupam a altura final — e se sumisse enquanto
 * carrega, a pagina saltaria quando a resposta chegasse.
 *
 * E exportada porque a home precisa da mesma resposta antes de montar: e ela
 * quem decide onde entram a faixa de colecoes e qual prateleira encosta no
 * banner, e as duas dependem de quantas prateleiras de fato aparecem. Com a
 * regra escrita duas vezes, bastaria mexer numa delas para a faixa reaparecer
 * no lugar errado sem que nada quebrasse.
 */
export function shelfWillRender({ products, isLoading, isError }: ShelfContent): boolean {
  return !isError && (isLoading || (products !== undefined && products.length > 0));
}

/**
 * Uma prateleira da vitrine: titulo, atalho para a secao inteira e a fileira
 * de produtos.
 *
 * ## Por que fileira que rola, e nao grade
 *
 * Com grade, oito produtos viram duas linhas no desktop e quatro no celular —
 * e tres prateleiras assim faziam a home passar de dez mil pixels de altura no
 * telefone. Quem rola tudo aquilo chega ao rodape exausto e sem ter visto a
 * terceira prateleira.
 *
 * Na fileira, cada prateleira ocupa a altura de um card. O cliente varre na
 * horizontal o que interessa e desce rapido para a proxima secao — que e como
 * se anda numa loja de verdade, passando os olhos pela prateleira e seguindo.
 *
 * ## A rolagem e do navegador
 *
 * Nao ha estado de slide, nem indice, nem temporizador: e `overflow-x` com
 * `scroll-snap`. O arrasto no touch, a roda inclinada do trackpad, o arrastar
 * da barra e o salto do navegador para revelar um link que recebeu foco — tudo
 * isso ja funciona, de graca e do jeito que a plataforma faz. As setas so
 * chamam `scrollBy`; elas sao um atalho de mouse por cima do que ja anda
 * sozinho, e nao o mecanismo.
 */
export function ProductShelf({
  title,
  description,
  products,
  isLoading,
  isError = false,
  to,
  linkLabel = 'Ver todos',
  skeletonCount = DEFAULT_SKELETON_COUNT,
  tinted = false,
  flush = false,
  className,
}: ProductShelfProps) {
  const titleId = useId();
  const trackRef = useRef<HTMLUListElement>(null);

  // Onde a fileira esta: e o que decide se cada seta tem para onde levar.
  // Uma seta que nao faz nada e pior que seta nenhuma.
  const [reach, setReach] = useState({ start: true, end: false });

  const measure = useCallback((): void => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    // A folga de 2px absorve o arredondamento de subpixel do navegador: sem
    // ela, a fileira rolada ate o fim quase nunca bate exatamente no limite e
    // a seta da direita fica acesa sem ter para onde ir.
    const maxScroll = track.scrollWidth - track.clientWidth;

    setReach({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft >= maxScroll - 2,
    });
  }, []);

  // A primeira medida, e a de toda vez que a caixa muda de largura — girar o
  // celular, arrastar a janela. Sem ela, com poucos produtos a fileira cabe
  // inteira na tela e a seta da direita ficaria acesa sem ter para onde ir.
  //
  // `ResizeObserver` existe em todo navegador que a loja atende, mas nao no
  // jsdom dos testes; a guarda e para ele.
  useEffect(() => {
    const track = trackRef.current;

    if (track === null || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);

    observer.observe(track);

    return () => {
      observer.disconnect();
    };
  }, [measure]);

  // Uma lista nova muda o `scrollWidth` sem mudar a caixa da fileira, e o
  // observador acima nao dispara: quem ele observa e o elemento, e ele
  // continua do mesmo tamanho com dois ou com doze cards dentro.
  const count = products?.length ?? 0;

  useEffect(() => {
    if (count > 0) {
      measure();
    }
  }, [measure, count]);

  const scrollBy = (direction: 1 | -1): void => {
    const track = trackRef.current;

    if (track) {
      // Uma tela por clique, menos um card de sobreposicao: o produto que
      // estava na beirada continua visivel e o cliente nao perde o fio.
      track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' });
    }
  };

  if (!shelfWillRender({ products, isLoading, isError })) {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading || undefined}
      className={cx(styles.shelf, flush && styles.flush, tinted && styles.tinted, className)}
    >
      <Container>
        <SectionHeading title={title} description={description} titleId={titleId} />

        {/* O atalho fica logo abaixo do titulo, e nao no fim da fileira: no
            fim, ele so aparece para quem rolou a prateleira inteira — ou
            seja, para quem menos precisa dele. */}
        {to ? (
          <Link to={to} className={styles.headingLink}>
            {linkLabel}
          </Link>
        ) : null}
      </Container>

      {/*
        A fileira sangra ate a borda da tela de proposito. O `Container` para
        no titulo: se ele envolvesse a fileira tambem, o card da ponta
        terminaria no limite do container e daria a impressao de que a
        prateleira acaba ali. Sangrando, o card sai pela beirada e diz que ha
        mais coisa a direita sem precisar de nenhuma legenda.
      */}
      <div className={styles.viewport}>
        <ul ref={trackRef} className={styles.track} onScroll={measure}>
          {isLoading
            ? Array.from({ length: skeletonCount }, (_, index) => (
                <li key={index} className={styles.item}>
                  <ProductCardSkeleton />
                </li>
              ))
            : products?.map((product) => (
                <li key={product.id} className={styles.item}>
                  <ProductCard product={product} />
                </li>
              ))}
        </ul>

        {/*
          As setas so existem onde ha mouse. No toque, arrastar e o gesto
          nativo — e duas setas sobre a fileira comeriam a largura de meio card
          numa tela de 390px.

          `aria-hidden` porque elas nao acrescentam nada a quem nao usa mouse:
          os links dos produtos ja estao todos na ordem do Tab, e o navegador
          rola a fileira sozinho para revelar o que recebeu foco.
        */}
        <div className={styles.arrows} aria-hidden="true">
          <button
            type="button"
            className={cx(styles.arrow, styles.arrowPrevious)}
            disabled={reach.start}
            tabIndex={-1}
            onClick={() => {
              scrollBy(-1);
            }}
          >
            <ArrowGlyph />
          </button>

          <button
            type="button"
            className={styles.arrow}
            disabled={reach.end}
            tabIndex={-1}
            onClick={() => {
              scrollBy(1);
            }}
          >
            <ArrowGlyph />
          </button>
        </div>
      </div>
    </section>
  );
}

function ArrowGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
