import { useEffect, useState } from 'react';

/**
 * A página já saiu do topo?
 *
 * E o que decide se o cabeçalho esta em repouso ou encolhido. O estado e um
 * booleano, e não a posição do scroll: assim o componente só renderiza de
 * novo nas duas travessias do limiar, e não a cada pixel rolado.
 *
 * A leitura acontece dentro de um `requestAnimationFrame` porque `scrollY` e
 * uma propriedade que força o navegador a recalcular layout. Ler uma vez por
 * quadro, e não uma vez por evento de scroll — que em trackpad dispara
 * dezenas de vezes por quadro — e a diferença entre um cabeçalho que encolhe
 * suave e um que engasga.
 *
 * Os dois limiares não são o mesmo número, e e proposital. O cabeçalho troca
 * de altura sem transição — animar a altura de um elemento sticky remedia a
 * página a cada quadro —, então a troca e um salto, e um salto que acontece
 * nos dois sentidos no mesmo pixel pisca: encolher sobe o conteúdo, e o
 * conteúdo subindo pode devolver a rolagem para baixo do limiar, que devolve
 * a altura, que desce o conteúdo de novo. Com a volta atrasada para 8px, a
 * faixa entre 8 e 24 e terra de ninguém: quem entra encolhido só volta ao
 * repouso perto do topo de verdade.
 */
export function useScrolled(threshold = 24, release = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = (): void => {
      frame = 0;
      // Quem já esta encolhido responde ao limiar de volta; quem esta em
      // repouso, ao de ida.
      setScrolled((was) => (was ? window.scrollY > release : window.scrollY > threshold));
    };

    const onScroll = (): void => {
      if (frame === 0) {
        frame = requestAnimationFrame(read);
      }
    };

    // Uma leitura na montagem: quem chega por um link com ancora, ou recarrega
    // a página no meio dela, já começa com a página rolada.
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
