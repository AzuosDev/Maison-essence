import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
 * ## Ele nunca se esconde sozinho
 *
 * Decisão da dona, e e o eixo deste componente: o brinde fica aparente em
 * toda página da loja. O site não o recolhe na rolagem, não o esconde depois
 * de um tempo e não guarda que alguém o fechou — a campanha e o motivo de a
 * cliente somar mais um frasco, e um aviso que some na primeira rolagem não
 * alcanca a terceira página de catálogo, que e onde a decisão acontece.
 *
 * O que existe e tirar o cartão da frente **nesta** página: o × troca o
 * cartão pelo círculo dourado, do mesmo diâmetro do botão do WhatsApp do
 * outro lado da tela. O brinde continua na tela — muda de tamanho, não de
 * presença. Na página seguinte o cartão volta inteiro, e essa volta e
 * deliberada, não esquecimento.
 *
 * A única coisa que mexe no balão sem a cliente pedir e o rodapé: ao chegar
 * nele o balão sobe 64px para não cobrir os links, do mesmo jeito que o botão
 * do WhatsApp faz do outro lado.
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

export function GiftBalloon({ avoidRef }: GiftBalloonProps) {
  const { settings } = useStoreSettings();
  const raised = useIsVisible(avoidRef);
  const { pathname } = useLocation();

  /*
   * O estado não e "fechado", e **em que página** a cliente fechou.
   *
   * O balão mora na moldura da loja e não e desmontado quando ela troca de
   * página, então um `open` booleano faria um × dado na home valer para a
   * visita inteira — e o brinde passaria o resto do caminho encolhido num
   * círculo. Guardando o endereço, a comparação se resolve na renderização:
   * mudou de página, mudou o endereço, o cartão volta inteiro.
   */
  const [closedOn, setClosedOn] = useState<string | null>(null);
  const open = closedOn !== pathname;

  const gift = settings?.gift ?? null;

  /*
   * Trocar de página renova o pulinho.
   *
   * O pulo do CSS dá três rajadas e para. Como o balão mora na moldura da
   * loja e **não** é remontado quando a cliente navega, ele terminaria na
   * primeira página e ficaria quieto pelo resto da visita — inclusive na
   * terceira página de catálogo, que é onde a decisão de somar mais um frasco
   * acontece.
   *
   * Reiniciar pelo `key` do React não serve: remontar o cartão redispara a
   * entrada dele, e um balão que reaparece do zero a cada página contradiz o
   * eixo deste componente — ele muda de tamanho, nunca de presença. Quem
   * reinicia, então, é a própria animação, pela API do navegador.
   */
  const rootRef = useRef<HTMLDivElement>(null);
  const hoppedOn = useRef(pathname);

  useEffect(() => {
    // Na primeira página não há nada a reiniciar: o elemento acabou de
    // nascer e a animação do CSS já partiu com ele. O que este efeito
    // atende é a página **seguinte**, em que o elemento é o mesmo.
    if (hoppedOn.current === pathname) {
      return;
    }

    hoppedOn.current = pathname;

    const target = rootRef.current?.querySelector('[data-hop]');

    // `getAnimations` não existe no jsdom da bancada, e onde há apontador o
    // respiro `hover: none` não declara animação nenhuma nesses elementos:
    // nos dois casos não há o que reiniciar.
    if (!target || typeof target.getAnimations !== 'function') {
      return;
    }

    for (const animation of target.getAnimations()) {
      animation.cancel();
      animation.play();
    }
  }, [pathname]);

  // Sem campanha configurada não há balão. E a mesma regra do botão do
  // WhatsApp sem número: melhor nada do que uma promessa sem dono.
  if (gift === null) {
    return null;
  }

  return (
    <div ref={rootRef} className={cx(styles.balloon, raised && styles.raised)}>
      {open ? (
        <div className={styles.card}>
          {/*
            O cartão inteiro leva a vitrine, menos o botão de fechar — que e
            irmão do link, e não filho dele: um botão dentro de um link não e
            clicável por teclado em nenhum navegador.
          */}
          <Link to={ROUTES.products} className={styles.offer}>
            <Figure image={gift.image} />

            <p className={styles.text}>
              Compre <strong className={cx(styles.amount, 'tabular')}>{formatCents(gift.minCents)}</strong> e ganhe{' '}
              {gift.label}
            </p>
          </Link>

          <button
            type="button"
            className={styles.close}
            aria-label="Encolher o aviso do brinde"
            onClick={() => {
              setClosedOn(pathname);
            }}
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-hop
          className={styles.circle}
          aria-label={`Ver o brinde: compre ${formatCents(gift.minCents)} e ganhe ${gift.label}`}
          onClick={() => {
            setClosedOn(null);
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
      <span data-hop className={styles.mark} aria-hidden="true">
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
      data-hop
      className={styles.photo}
    />
  );
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
