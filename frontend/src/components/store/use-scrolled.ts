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
 *
 * Os dois limiares nao sao o mesmo numero, e e proposital. O cabecalho troca
 * de altura sem transicao — animar a altura de um elemento sticky remedia a
 * pagina a cada quadro —, entao a troca e um salto, e um salto que acontece
 * nos dois sentidos no mesmo pixel pisca: encolher sobe o conteudo, e o
 * conteudo subindo pode devolver a rolagem para baixo do limiar, que devolve
 * a altura, que desce o conteudo de novo. Com a volta atrasada para 8px, a
 * faixa entre 8 e 24 e terra de ninguem: quem entra encolhido so volta ao
 * repouso perto do topo de verdade.
 */
export function useScrolled(threshold = 24, release = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = (): void => {
      frame = 0;
      // Quem ja esta encolhido responde ao limiar de volta; quem esta em
      // repouso, ao de ida.
      setScrolled((was) => (was ? window.scrollY > release : window.scrollY > threshold));
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
  }, [threshold, release]);

  return scrolled;
}
