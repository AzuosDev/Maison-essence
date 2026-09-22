import { useEffect, useState, type RefObject } from 'react';
import { useStoreSettings } from '@/features/settings';
import { cx } from '@/lib/cx';
import { WhatsappIcon } from './icons';
import styles from './whatsapp-button.module.css';

/**
 * O botao flutuante do WhatsApp.
 *
 * O numero vem das configuracoes, e o link tambem: a API ja devolve
 * `whatsappLink` pronto (`https://wa.me/<numero>`), o que evita duas pontas
 * montando a URL com regras que podem divergir. O que se acrescenta aqui e o
 * `?text=`, com a mensagem de abertura.
 *
 * Sem numero configurado, o botao nao aparece. Um botao de WhatsApp que abre
 * uma conversa com ninguem e pior do que a ausencia dele.
 *
 * Ao chegar ao rodape, o botao sobe em vez de sumir: quem rolou a pagina
 * inteira e justamente quem esta prestes a perguntar alguma coisa.
 */
interface WhatsappButtonProps {
  /**
   * O elemento de que o botao precisa se afastar — o rodape.
   *
   * Vem por `ref`, e nao por seletor, porque quem monta a pagina e o layout:
   * um `querySelector('footer')` aqui dentro amarraria este componente a uma
   * estrutura de DOM que ele nao controla.
   */
  avoidRef?: RefObject<HTMLElement | null>;
}

/** O que ja vai escrito na conversa. A dona recebe o contexto junto. */
const DEFAULT_MESSAGE = 'Ola! Vim pelo site e gostaria de saber mais.';

export function WhatsappButton({ avoidRef }: WhatsappButtonProps) {
  const { settings } = useStoreSettings();
  const raised = useIsVisible(avoidRef);

  if (!settings?.whatsappLink) {
    return null;
  }

  const href = `${settings.whatsappLink}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      // `noopener` nao e formalidade: sem ele, a aba aberta consegue mexer na
      // pagina de origem por `window.opener`.
      rel="noreferrer noopener"
      className={cx(styles.button, raised && styles.raised)}
      aria-label="Falar com a loja no WhatsApp"
    >
      <WhatsappIcon />
    </a>
  );
}

/**
 * O elemento observado esta na tela?
 *
 * `IntersectionObserver` e nao um listener de scroll: o navegador avisa
 * quando a travessia acontece, sem que este componente pergunte a cada
 * quadro qual e a posicao do rodape — o que custaria um recalculo de layout
 * por pergunta.
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
      // Comeca a valer um pouco antes: o botao sai da frente enquanto o
      // rodape sobe, e nao no instante em que ele ja cobriu os links.
      { rootMargin: '0px 0px -64px 0px' },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return visible;
}
