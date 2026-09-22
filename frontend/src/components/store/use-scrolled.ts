import { useEffect, useState } from 'react';

/**
 * A pagina ja saiu do topo?
 *
 * E o que decide se o cabecalho esta em repouso ou encolhido. O estado e um
 * booleano, e nao a posicao do scroll: assim o componente so renderiza de
 * novo nas duas travessias do limiar, e nao a cada pixel rolado.
 *
 * A leitura acontece dentro de um `requestAnimationFrame` porque `scrollY` e
 * uma propriedade que forca o navegador a recalcular layout. Ler uma vez por
 * quadro, e nao uma vez por evento de scroll — que em trackpad dispara
 * dezenas de vezes por quadro — e a diferenca entre um cabecalho que encolhe
 * suave e um que engasga.
 */
export function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = (): void => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };

    const onScroll = (): void => {
      if (frame === 0) {
        frame = requestAnimationFrame(read);
      }
    };

    // Uma leitura na montagem: quem chega por um link com ancora, ou recarrega
    // a pagina no meio dela, ja comeca com a pagina rolada.
    read();

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);

      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, [threshold]);

  return scrolled;
}
