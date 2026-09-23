import { useState, type CSSProperties, type MouseEvent } from 'react';
import { imageProps } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { useMediaQuery } from '@/lib/use-media-query';
import { usePinchZoom } from './use-pinch-zoom';
import styles from './product-gallery.module.css';

/**
 * A galeria do produto.
 *
 * Uma foto grande e um jeito de chegar as outras — miniaturas em coluna no
 * desktop, pontos no celular. Os dois conjuntos fazem a mesma coisa, entao
 * so um e montado: com os dois no documento e um escondido por CSS, quem usa
 * leitor de tela ouviria "foto 2" duas vezes e nao saberia qual das duas
 * listas esta vendo.
 *
 * ## Ampliar, de dois jeitos
 *
 * No desktop, o cursor e a lupa: a foto amplia duas vezes e o ponto sob o
 * cursor fica parado, porque e para la que a pessoa esta olhando. E o
 * comportamento de vitrine que todo mundo ja conhece, e nao pede clique
 * nenhum.
 *
 * No celular, a pinca — `usePinchZoom`, que explica o gesto. As duas coisas
 * nao coexistem: o aparelho ou tem cursor fino ou tem dedo.
 *
 * ## A troca de foto
 *
 * Quem controla o indice e a pagina, e nao a galeria. E o que permite a
 * escolha de uma variante com foto propria trocar a foto principal — a
 * pagina resolve qual foto e a da variante e diz qual mostrar. Uma galeria
 * com indice proprio precisaria ser avisada por efeito, e piscaria na foto
 * antiga antes de obedecer.
 */

/** A partir daqui, miniaturas em coluna. Abaixo, pontos. */
const DESKTOP = '(min-width: 64rem)';

/** Aparelho com cursor de verdade: e onde a lupa faz sentido. */
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

/** Quanto a lupa amplia. Duas vezes le o rotulo sem virar mosaico. */
const MAGNIFIER_SCALE = 2;

/** A foto ocupa metade da tela no desktop e a largura inteira no celular. */
const GALLERY_SIZES = '(min-width: 64rem) 46vw, 100vw';

export interface ProductGalleryProps {
  /** Os `publicId`s, na ordem. Vazio desenha o marcador de "sem foto". */
  images: readonly string[];
  /** O nome do produto, para o texto alternativo. */
  alt: string;
  index: number;
  onIndexChange: (index: number) => void;
}

export function ProductGallery({ images, alt, index, onIndexChange }: ProductGalleryProps) {
  const isDesktop = useMediaQuery(DESKTOP);
  const canMagnify = useMediaQuery(FINE_POINTER);
  // A coluna de miniaturas so e reservada na grade quando ela existe de
  // fato. Produto de foto unica nao monta a lista, e um `grid-template`
  // fixo em duas faixas jogaria a foto grande dentro dos 5rem da primeira.
  const hasThumbs = isDesktop && images.length > 1;

  const pinch = usePinchZoom();
  const [origin, setOrigin] = useState<string | null>(null);

  const current = images[index] ?? '';
  const total = images.length;

  const select = (next: number): void => {
    // A ampliacao nao sobrevive a troca de foto: ficar no 3x sobre um canto
    // da foto nova nao e o que ninguem pediu ao clicar na miniatura.
    pinch.reset();
    setOrigin(null);
    onIndexChange(next);
  };

  const track = (event: MouseEvent<HTMLDivElement>): void => {
    if (!canMagnify) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    setOrigin(`${String(round(x))}% ${String(round(y))}%`);
  };

  const magnified = canMagnify && origin !== null;

  const frameStyle: CSSProperties = magnified
    ? { transformOrigin: origin, transform: `scale(${String(MAGNIFIER_SCALE)})` }
    : pinch.style;

  return (
    <div className={cx(styles.gallery, hasThumbs && styles.galleryWithThumbs)}>
      {hasThumbs ? (
        <ul className={styles.thumbs} aria-label="Fotos do produto">
          {images.map((publicId, position) => (
            <li key={publicId}>
              <button
                type="button"
                className={cx(styles.thumb, position === index && styles.thumbActive)}
                aria-current={position === index ? 'true' : undefined}
                aria-label={`Foto ${String(position + 1)} de ${String(total)}`}
                onClick={() => {
                  select(position);
                }}
                // A foto grande ja fica pronta antes do clique.
                onMouseEnter={() => {
                  select(position);
                }}
              >
                <img
                  {...imageProps(publicId, 'thumb', '80px')}
                  alt=""
                  width={80}
                  height={107}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.stage}>
        {/* O quadro e quem escuta o cursor e os dedos; a `<img>` dentro dele
            e quem se transforma. Separados assim, a moldura nao cresce junto
            com a foto e o excedente fica escondido nela. */}
        <div
          className={cx(styles.frame, (magnified || pinch.zoomed) && styles.zooming)}
          onMouseMove={track}
          onMouseLeave={() => {
            setOrigin(null);
          }}
          {...pinch.handlers}
        >
          <img
            {...imageProps(current, 'detail', GALLERY_SIZES)}
            alt={total > 1 ? `${alt} — foto ${String(index + 1)} de ${String(total)}` : alt}
            className={styles.image}
            style={frameStyle}
            width={1200}
            height={1600}
            // A foto principal do produto e a maior imagem da dobra: ela
            // carrega de imediato e com prioridade, como o hero da home.
            loading="eager"
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />

          {canMagnify && total > 0 ? (
            <p className={styles.hint} aria-hidden="true">
              Passe o mouse para ampliar
            </p>
          ) : null}
        </div>

        {/* Os pontos sao uma lista, como a coluna de miniaturas do desktop:
            sao os mesmos botoes para as mesmas fotos, e quem ouve a pagina
            deve encontrar a mesma estrutura nos dois tamanhos de tela. */}
        {!isDesktop && total > 1 ? (
          <ul className={styles.dots} aria-label="Fotos do produto">
            {images.map((publicId, position) => (
              <li key={publicId}>
                <button
                  type="button"
                  className={cx(styles.dot, position === index && styles.dotActive)}
                  aria-current={position === index ? 'true' : undefined}
                  aria-label={`Foto ${String(position + 1)} de ${String(total)}`}
                  onClick={() => {
                    select(position);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
