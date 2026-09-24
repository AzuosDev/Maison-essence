import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { ProductCard, SectionHeading } from '@/components/store';
import { ChevronDownIcon } from '@/components/store/icons';
import { Container } from '@/components/ui';
import type { PublicProduct } from '@/features/catalog';
import { cx } from '@/lib/cx';
import { useMediaQuery } from '@/lib/use-media-query';
import styles from './related-products.module.css';

/**
 * O que mais existe na mesma categoria, no fim da página.
 *
 * Carrossel, e não grade — e a diferença e de intenção. A grade da home
 * convida a percorrer o catálogo; aqui embaixo o cliente já tem um produto em
 * mãos, e a faixa e uma segunda opção oferecida de lado, sem tomar a altura
 * de tela que uma grade de oito tomaria. Quem não esta interessado passa
 * direto para o rodapé.
 *
 * ## A rolagem e do navegador
 *
 * Nada de `transform` com índice: a faixa e uma lista que rola, com
 * `scroll-snap` encaixando cada card. Isso da de graça o que uma pilha de
 * slides animados custa caro — o deslize com o dedo, o atrito do sistema, o
 * Tab que rola até o card focado e a roda horizontal do trackpad. Os botões
 * do desktop só empurram a mesma rolagem.
 *
 * Os botões desaparecem quando não há o que rolar: dois produtos
 * relacionados cabem na tela, e uma seta que não leva a lugar nenhum e um
 * convite a clicar em nada.
 */

/** O `sizes` da faixa: um card e pouco menos que a tela no celular. */
const CARD_SIZES = '(min-width: 64rem) 25vw, (min-width: 40rem) 40vw, 72vw';

/** Quanto cada clique anda: quase uma tela, com uma sobra para o contexto. */
const STEP_RATIO = 0.9;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function RelatedProducts({ products }: { products: readonly PublicProduct[] }) {
  const titleId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const track = trackRef.current;

    if (track === null) {
      return;
    }

    // Um pixel de folga nas duas pontas: com zoom do navegador ou largura
    // fracionaria, `scrollLeft` para em 0.5 e o botão ficaria eternamente
    // habilitado no começo da faixa.
    setAtStart(track.scrollLeft <= 1);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 1);
  }, []);

  // A medida antes da pintura: com `useEffect`, as setas apareceriam
  // habilitadas por um quadro numa faixa que nem rola.
  useLayoutEffect(() => {
    const track = trackRef.current;

    if (track === null || typeof ResizeObserver === 'undefined') {
      return;
    }

    // A faixa muda de largura sem rolar nenhuma vez — girar o celular, abrir
    // o console, arrastar a janela — e o `onScroll` não tem como saber. O
    // observador já mede uma vez ao começar a observar.
    const observer = new ResizeObserver(measure);

    observer.observe(track);

    return () => {
      observer.disconnect();
    };
  }, [measure]);

  // Uma lista nova muda o `scrollWidth` sem mudar a caixa da faixa, e o
  // observador acima não dispara: quem a observa e o elemento, e ele
  // continua do mesmo tamanho com dois ou com doze cards dentro.
  useLayoutEffect(() => {
    if (products.length > 0) {
      measure();
    }
  }, [measure, products.length]);

  const scrollBy = (direction: 1 | -1): void => {
    const track = trackRef.current;

    if (track === null) {
      return;
    }

    track.scrollBy({
      left: track.clientWidth * STEP_RATIO * direction,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  if (products.length === 0) {
    return null;
  }

  const scrollable = !atStart || !atEnd;

  return (
    <section className={styles.shelf} aria-labelledby={titleId}>
      <Container>
        <div className={styles.header}>
          <SectionHeading
            title="Você também pode gostar"
            description="Da mesma categoria, na ordem em que a casa os destaca."
            titleId={titleId}
          />

          {scrollable ? (
            <div className={styles.arrows}>
              <ArrowButton
                direction="previous"
                disabled={atStart}
                onClick={() => {
                  scrollBy(-1);
                }}
              />

              <ArrowButton
                direction="next"
                disabled={atEnd}
                onClick={() => {
                  scrollBy(1);
                }}
              />
            </div>
          ) : null}
        </div>

        <ul ref={trackRef} className={styles.track} onScroll={measure}>
          {products.map((product) => (
            <li key={product.id} className={styles.slide}>
              <ProductCard product={product} sizes={CARD_SIZES} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

interface ArrowButtonProps {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
}

/**
 * A seta, que e o chevron do sistema girado.
 *
 * Um ícone novo para cada lado seriam dois caminhos SVG a manter em dia com
 * o mesmo traço; o giro sai do mesmo desenho e não pode divergir dele.
 */
function ArrowButton({ direction, disabled, onClick }: ArrowButtonProps) {
  const previous = direction === 'previous';

  return (
    <button
      type="button"
      className={cx(styles.arrow, previous ? styles.previous : styles.next)}
      disabled={disabled}
      aria-label={previous ? 'Ver os produtos anteriores' : 'Ver os próximos produtos'}
      onClick={onClick}
    >
      <ChevronDownIcon />
    </button>
  );
}
