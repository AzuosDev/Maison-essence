import { useEffect, useState, type RefObject } from 'react';
import { useStoreSettings } from '@/features/settings';
import { cx } from '@/lib/cx';
import { WhatsappIcon } from './icons';
import styles from './whatsapp-button.module.css';

/**
 * O botão flutuante do WhatsApp.
 *
 * O número vem das configurações, e o link também: a API já devolve
 * `whatsappLink` pronto (`https://wa.me/<numero>`), o que evita duas pontas
 * montando a URL com regras que podem divergir. O que se acrescenta aqui e o
 * `?text=`, com a mensagem de abertura.
 *
 * Sem número configurado, o botão não aparece. Um botão de WhatsApp que abre
 * uma conversa com ninguém e pior do que a ausência dele.
 *
 * Ao chegar ao rodapé, o botão sobe em vez de sumir: quem rolou a página
 * inteira e justamente quem esta prestes a perguntar alguma coisa.
 */
interface WhatsappButtonProps {
  /**
   * O elemento de que o botão precisa se afastar — o rodapé.
   *
   * Vem por `ref`, e não por seletor, porque quem monta a página e o layout:
   * um `querySelector('footer')` aqui dentro amarraria este componente a uma
   * estrutura de DOM que ele não controla.
   */
  avoidRef?: RefObject<HTMLElement | null>;
}

/** O que já vai escrito na conversa. A dona recebe o contexto junto. */
const DEFAULT_MESSAGE = 'Olá! Vim pelo site e gostaria de saber mais.';

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
      // `noopener` não e formalidade: sem ele, a aba aberta consegue mexer na
      // página de origem por `window.opener`.
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
 * `IntersectionObserver` e não um listener de scroll: o navegador avisa
 * quando a travessia acontece, sem que este componente pergunte a cada
 * quadro qual e a posição do rodapé — o que custaria um recálculo de layout
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
      // Começa a valer um pouco antes: o botão sai da frente enquanto o
      // rodapé sobe, e não no instante em que ele já cobriu os links.
      { rootMargin: '0px 0px -64px 0px' },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return visible;
}
