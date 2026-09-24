import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useStoreSettings } from '@/features/settings';
import styles from './announcement-bar.module.css';

/**
 * A barra preta do topo, com o aviso da loja rolando.
 *
 * O texto vem de `announcementText` das configurações — a dona edita no
 * painel e a barra muda sem deploy. Quando não há texto, a barra não existe:
 * uma faixa preta vazia no topo da loja e pior que faixa nenhuma.
 *
 * ## Por que o aviso e repetido, e por que a conta e feita aqui
 *
 * A faixa e uma fita sem fim: o aviso se repete, separado por losangos, e
 * desliza para a esquerda em loop. Para isso ela precisa de duas garantias —
 * cobrir a largura da tela e emendar sem costura — e as duas dependem de um
 * número que só o navegador sabe: quanto mede **uma** copia do aviso.
 *
 * Por isso a medição. Duas copias fixas no markup, que era o desenho
 * anterior, davam uma fita do tamanho do texto: "Teste de frete" rendia 370px
 * de fita numa tela de 1920, e os outros 1550 ficavam pretos e vazios — a
 * fita mal se mexia num canto em vez de atravessar a tela.
 *
 * A conta: `copiasPorVolta` e quantas copias cobrem a tela, mais uma de
 * folga. O markup traz o dobro disso, e a animação desloca a fita em
 * exatamente metade dela — quando a primeira metade termina de sair pela
 * esquerda, a segunda esta no lugar onde a primeira começou, e o ciclo
 * recomeca sem emenda visível.
 *
 * ## A duração também sai daqui
 *
 * Uma duração fixa no CSS faria a velocidade depender do tamanho do texto: a
 * mesma volta de 28 segundos que arrastava "Teste de frete" a 6px por segundo
 * dispararia com um aviso de três linhas. Aqui a duração e derivada da
 * distancia, e o que fica constante e o que o olho percebe — a velocidade.
 *
 * Para quem ouve a página o aviso continua sendo um só: a primeira copia e a
 * única que o leitor de tela enxerga, e todas as outras são `aria-hidden`.
 */

/** Pixels por segundo. Passo de vitrine: dá para ler sem correr atrás. */
const SPEED = 60;

/** Enquanto a primeira medida não chega: duas copias e nenhuma pressa. */
const INITIAL_LAP = { copies: 1, seconds: 0 };

export function AnnouncementBar() {
  const { settings } = useStoreSettings();
  const text = settings?.announcementText.trim();

  const viewportRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLParagraphElement>(null);

  const [lap, setLap] = useState(INITIAL_LAP);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const copy = copyRef.current;

    if (!viewport || !copy) {
      return;
    }

    const unit = copy.getBoundingClientRect().width;
    const visible = viewport.getBoundingClientRect().width;

    // Fonte ainda carregando, aba em segundo plano: medida zerada não vira
    // divisão por zero nem uma fita de mil copias.
    if (unit < 1 || visible < 1) {
      return;
    }

    const copies = Math.ceil(visible / unit) + 1;
    const seconds = (copies * unit) / SPEED;

    // Só troca o estado quando o número muda de verdade. O observador abaixo
    // dispara na primeira pintura e a cada troca de caixa, e um objeto novo a
    // cada disparo remontaria a fita — e reiniciaria a animação — sem motivo.
    setLap((current) =>
      current.copies === copies && Math.abs(current.seconds - seconds) < 0.01
        ? current
        : { copies, seconds },
    );
  }, []);

  // A primeira medida, e a de toda vez que a caixa muda: girar o celular,
  // arrastar a janela, a fonte da marca terminando de carregar.
  //
  // `useLayoutEffect` e não `useEffect`: a conta precisa estar feita antes da
  // pintura, senão a fita aparece curta por um quadro e se estica na cara de
  // quem esta olhando. `ResizeObserver` existe em todo navegador que a loja
  // atende, mas não no jsdom dos testes; a guarda e para ele.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const copy = copyRef.current;

    // `text` na condição e nas dependências não e enfeite: sem aviso a barra
    // não existe, e o efeito da primeira montagem não encontra elemento
    // nenhum para medir. E quando o texto chega — as configurações vem da
    // API, um instante depois — e ele que manda o efeito rodar de novo.
    if (!text || !viewport || !copy) {
      return;
    }

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);

    observer.observe(viewport);
    observer.observe(copy);

    return () => {
      observer.disconnect();
    };
  }, [measure, text]);

  if (!text) {
    return null;
  }

  return (
    <div className={styles.bar}>
      <div ref={viewportRef} className={styles.viewport}>
        <div
          className={styles.track}
          style={lap.seconds > 0 ? { animationDuration: `${lap.seconds}s` } : undefined}
        >
          {Array.from({ length: lap.copies * 2 }, (_, index) => (
            <p
              key={index}
              ref={index === 0 ? copyRef : undefined}
              className={styles.copy}
              aria-hidden={index === 0 ? undefined : true}
            >
              {text}
              <span className={styles.separator} aria-hidden="true">
                ◆
              </span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
