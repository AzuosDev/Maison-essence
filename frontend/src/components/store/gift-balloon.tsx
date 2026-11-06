import { useCallback, useEffect, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useStoreSettings } from '@/features/settings';
import { imageProps } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import { CloseIcon, GiftIcon } from './icons';
import styles from './gift-balloon.module.css';

/**
 * O balão do brinde: "Compre R$ 179,99 e ganhe um porta hidratante".
 *
 * ## Por que ele flutua, e por que a esquerda
 *
 * O brinde e um motivo para somar mais um frasco, e a decisão de somar não
 * acontece na home — acontece na terceira página de catálogo, com dois itens
 * na sacola. Um bloco na home não alcanca esse momento; um balão que segue a
 * cliente, sim.
 *
 * A esquerda porque a direita já e do WhatsApp. Os dois no mesmo canto
 * virariam uma pilha de botões, e o canto inferior direito e o que o polegar
 * cobre no celular.
 *
 * ## Dois tamanhos, um estado
 *
 * Aberto e o cartão com a foto e a frase; fechado e o círculo dourado — o
 * mesmo diâmetro do botão do WhatsApp, do outro lado da tela, porque dois
 * flutuantes de tamanhos diferentes nas duas pontas desequilibram o rodapé da
 * tela.
 *
 * O estado e um só e vive na sessão: fechado numa página, continua fechado na
 * seguinte. Um balão que reabrisse a cada navegação seria propaganda
 * perseguindo quem já disse não — e o círculo continua ali, dourado, para
 * quem mudar de ideia.
 *
 * Rolar a página para baixo também fecha, e **não** reabre quando a rolagem
 * para: descer e procurar produto, e o cartão ficaria por cima de um deles.
 * A volta e sempre um clique da cliente, nunca do site.
 *
 * ## O que ele promete, promete de verdade
 *
 * A frase, o valor e a foto vem de `GET /settings`, onde a dona os edita. Sem
 * campanha configurada não há balão nenhum — e o mesmo brinde volta a
 * aparecer na régua da sacola e na mensagem do pedido que chega no WhatsApp
 * dela, que e o que faz a promessa chegar a quem separa a caixa.
 */
interface GiftBalloonProps {
  /**
   * O elemento de que o balão precisa se afastar — o rodapé.
   *
   * Vem por `ref` pelo mesmo motivo do botão do WhatsApp: quem monta a página
   * e o layout, e um `querySelector('footer')` aqui dentro amarraria este
   * componente a uma estrutura de DOM que ele não controla.
   */
  avoidRef?: RefObject<HTMLElement | null>;
}

/** Onde a escolha da cliente fica guardada enquanto a aba estiver aberta. */
const OPEN_KEY = 'maison:brinde-aberto';

export function GiftBalloon({ avoidRef }: GiftBalloonProps) {
  const { settings } = useStoreSettings();
  const [open, setOpen] = useState(readOpen);
  const raised = useIsVisible(avoidRef);

  // Estável entre renderizações: sem isto, o efeito da rolagem se
  // reinscreveria a cada quadro em que o componente renderizasse.
  const collapse = useCallback(() => {
    setOpen(false);
    writeOpen(false);
  }, []);

  useCollapseOnScroll(open, collapse);

  const gift = settings?.gift ?? null;

  // Sem campanha configurada não há balão. E a mesma regra do botão do
  // WhatsApp sem número: melhor nada do que uma promessa sem dono.
  if (gift === null) {
    return null;
  }

  const toggle = (next: boolean): void => {
    setOpen(next);
    writeOpen(next);
  };

  return (
    <div className={cx(styles.balloon, raised && styles.raised)}>
      {open ? (
        <div className={styles.card}>
          {/*
            O cartão inteiro leva a vitrine, menos o botão de fechar — que e
            irmão do link, e não filho dele: um botão dentro de um link não e
            clicável por teclado em nenhum navegador.
          */}
          <Link to={ROUTES.products} className={styles.offer} onClick={() => { toggle(false); }}>
            <Figure image={gift.image} />

            <p className={styles.text}>
              Compre <strong className={cx(styles.amount, 'tabular')}>{formatCents(gift.minCents)}</strong> e ganhe{' '}
              {gift.label}
            </p>
          </Link>

          <button
            type="button"
            className={styles.close}
            aria-label="Fechar o aviso do brinde"
            onClick={() => {
              toggle(false);
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.circle}
          aria-label={`Ver o brinde: compre ${formatCents(gift.minCents)} e ganhe ${gift.label}`}
          onClick={() => {
            toggle(true);
          }}
        >
          <GiftIcon />
        </button>
      )}
    </div>
  );
}

/**
 * A foto do brinde, quando a loja cadastrou uma.
 *
 * `alt=""` porque a frase ao lado já diz o que e: um `alt` com o nome do
 * brinde faria o leitor de tela anunciar a mesma coisa duas vezes. Sem foto,
 * entra o ícone — e o cartão continua tendo onde o olho pousar.
 */
function Figure({ image }: { image: string }) {
  if (image === '') {
    return (
      <span className={styles.mark} aria-hidden="true">
        <GiftIcon />
      </span>
    );
  }

  return (
    <img
      {...imageProps(image, 'thumb', '64px')}
      alt=""
      width="64"
      height="64"
      loading="lazy"
      decoding="async"
      className={styles.photo}
    />
  );
}

/**
 * A rolagem para baixo fecha o cartão.
 *
 * Mesma medida do botão do WhatsApp (dez pixels, e só depois dos primeiros
 * duzentos) para que os dois flutuantes reajam ao mesmo gesto — um saindo
 * para a direita enquanto o outro encolhe a esquerda e um tranco só, não dois.
 *
 * Só desce fecha. Subir não reabre, e parar também não: reabrir sozinho seria
 * o site insistindo em cima de quem acabou de fechar.
 */
const COLLAPSE_THRESHOLD_PX = 10;
const QUIET_ZONE_PX = 200;

function useCollapseOnScroll(open: boolean, collapse: () => void): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    let last = window.scrollY;
    let ticking = false;

    const measure = (): void => {
      ticking = false;

      const current = window.scrollY;
      const delta = current - last;

      if (Math.abs(delta) < COLLAPSE_THRESHOLD_PX) {
        return;
      }

      last = current;

      if (delta > 0 && current > QUIET_ZONE_PX) {
        collapse();
      }
    };

    const onScroll = (): void => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(measure);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [open, collapse]);
}

/**
 * O elemento observado esta na tela?
 *
 * `IntersectionObserver` e não um listener de rolagem, como no botão do
 * WhatsApp: o navegador avisa quando a travessia acontece, sem que este
 * componente pergunte a cada quadro onde o rodapé esta.
 */
function useIsVisible(ref: RefObject<HTMLElement | null> | undefined): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref?.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { rootMargin: '0px 0px -64px 0px' },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return visible;
}

/**
 * A escolha da cliente, guardada só enquanto a aba viver.
 *
 * `sessionStorage` e não `localStorage`: fechar o balão e uma decisão desta
 * visita, não para sempre. A loja pode trocar o brinde amanhã, e quem fechou
 * o balão de dezembro merece ver o de janeiro.
 *
 * Tudo dentro de `try`: janela anônima e navegador com dados de site
 * bloqueados fazem o acesso lancar, e um balão não pode derrubar a loja.
 */
function readOpen(): boolean {
  try {
    return window.sessionStorage.getItem(OPEN_KEY) !== 'nao';
  } catch {
    return true;
  }
}

function writeOpen(open: boolean): void {
  try {
    window.sessionStorage.setItem(OPEN_KEY, open ? 'sim' : 'nao');
  } catch {
    // Sem armazenamento, o balão simplesmente reabre na próxima página.
  }
}
