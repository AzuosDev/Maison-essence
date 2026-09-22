import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

/**
 * O estado de um carrossel que anda sozinho.
 *
 * Fica fora do componente porque sao quatro regras que nada tem a ver com o
 * desenho do hero, e todas as quatro sao do tipo que se esquece:
 *
 * 1. **Para no hover e no foco.** Um banner que troca enquanto o cliente le o
 *    texto ou percorre os indicadores com Tab e um banner que ele nunca
 *    termina de ler.
 * 2. **Para com a aba escondida.** O temporizador continuaria rodando numa
 *    aba em segundo plano, e o cliente voltaria para um banner diferente do
 *    que deixou — sem nunca ter visto os do meio.
 * 3. **Nao anda para quem pediu menos movimento.** `prefers-reduced-motion`
 *    vale para o giro automatico, nao so para a transicao: o movimento que
 *    incomoda e o conteudo trocando sozinho.
 * 4. **Volta ao comeco quando a lista encolhe.** A dona despublica o terceiro
 *    banner enquanto alguem esta nele; sem isto o indice ficaria apontando
 *    para um slide que nao existe mais.
 */

/** Seis segundos: o tempo de ler um titulo, um subtitulo e decidir. */
export const AUTOPLAY_MS = 6000;

export interface Carousel {
  index: number;
  goTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  /** Verdadeiro quando o giro automatico esta suspenso. */
  paused: boolean;
  /** Setas do teclado. Vai no elemento que contem os indicadores. */
  onKeyDown: (event: KeyboardEvent) => void;
  /** Suspende e retoma: `onMouseEnter`/`onMouseLeave`, `onFocus`/`onBlur`. */
  suspend: () => void;
  resume: () => void;
}

export function useCarousel(count: number, intervalMs = AUTOPLAY_MS): Carousel {
  const [requested, setIndex] = useState(0);

  // Regra 4: a lista pode ter encolhido debaixo do indice. Corrigido no
  // render, e nao por efeito — um efeito faria o carrossel desenhar uma vez
  // apontando para um slide que ja nao existe, e so entao se endireitar.
  const index = requested < count ? requested : 0;
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Regra 2: `visibilitychange` e o unico sinal confiavel de aba em segundo
  // plano. `blur` na janela tambem dispara ao trocar de programa, que e
  // justamente quando a pagina continua visivel num monitor ao lado.
  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.hidden);
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const paused = held || hidden || reducedMotion;

  useEffect(() => {
    if (count <= 1 || paused) {
      return;
    }

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [count, paused, intervalMs]);

  const goTo = useCallback(
    (next: number) => {
      if (count > 0) {
        setIndex(((next % count) + count) % count);
      }
    },
    [count],
  );

  const next = useCallback(() => {
    setIndex((current) => (count > 0 ? (current + 1) % count : 0));
  }, [count]);

  const previous = useCallback(() => {
    setIndex((current) => (count > 0 ? (current - 1 + count) % count : 0));
  }, [count]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }
    },
    [next, previous],
  );

  const suspend = useCallback(() => {
    setHeld(true);
  }, []);

  const resume = useCallback(() => {
    setHeld(false);
  }, []);

  return { index, goTo, next, previous, paused, onKeyDown, suspend, resume };
}

/**
 * A preferencia do sistema por menos movimento, acompanhada ao vivo.
 *
 * Lida no inicializador do `useState` — e nao num efeito — para que o
 * primeiro render ja saia certo: com a leitura no efeito, o carrossel daria
 * um passo antes de descobrir que nao deveria dar nenhum.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onChange = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    query.addEventListener('change', onChange);

    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return reduced;
}
