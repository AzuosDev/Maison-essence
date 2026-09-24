import { useCallback, useEffect, useRef, type RefObject } from 'react';

/**
 * O comportamento que o modal e a gaveta tem em comum.
 *
 * São três obrigações, e nenhuma e detalhe: quem abre um diálogo com o
 * teclado precisa conseguir sair dele com o teclado, e quem usa leitor de
 * tela precisa que o foco esteja *dentro* do diálogo — senão a leitura
 * continua na página atrás do véu, que visualmente não existe mais.
 *
 * 1. **Prender o foco.** O Tab circula entre os elementos focáveis do
 *    diálogo e não escapa para a página.
 * 2. **Fechar no Escape.** Em qualquer lugar do diálogo.
 * 3. **Devolver o foco.** Ao fechar, o foco volta para o elemento que abriu.
 *    Sem isso, o Tab seguinte recomeca do início do documento e quem estava
 *    no meio de um formulário se perde.
 *
 * O hook esta separado dos dois componentes porque duplicar isto seria
 * duplicar a chance de esquecer um dos três.
 */

/** O que o navegador considera alcancável pelo Tab, na ordem do documento. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogOptions {
  open: boolean;
  onClose: () => void;
  /**
   * Fecha ao clicar no véu. Ligado por padrão; o passo de checkout que não
   * pode ser abandonado no meio desliga.
   */
  closeOnOverlayClick?: boolean;
}

interface Dialog<T extends HTMLElement> {
  /** Vai no elemento que contem o diálogo — e dentro dele que o foco fica. */
  ref: RefObject<T>;
  /** Vai no véu: cuida do clique fora. */
  onOverlayClick: (event: React.MouseEvent) => void;
}

export function useDialog<T extends HTMLElement>({
  open,
  onClose,
  closeOnOverlayClick = true,
}: DialogOptions): Dialog<T> {
  const ref = useRef<T>(null);

  // O callback vive num ref para que o efeito dependa só de `open`. Se
  // dependesse de `onClose`, um pai que recria a função a cada render faria
  // o efeito rodar de novo — e o foco saltaria para o primeiro campo no meio
  // da digitação.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const node = ref.current;

    if (!node) {
      return;
    }

    // Quem abriu. `document.activeElement` ainda e o gatilho neste ponto,
    // porque o foco só se move na linha seguinte.
    const trigger = document.activeElement;

    focusFirst(node);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();

        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isVisible);

      if (items.length === 0) {
        // Diálogo sem nada focável: o foco fica no próprio container, que
        // tem `tabIndex={-1}`, em vez de vazar para a página.
        event.preventDefault();
        node.focus();

        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (!first || !last) {
        return;
      }

      const active = document.activeElement;

      // O Tab que sairia pela frente volta para o começo, e o Shift+Tab que
      // sairia por trás vai para o fim. O `!node.contains` cobre o caso de o
      // foco estar no container.
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Na fase de captura: o Escape precisa chegar aqui antes de qualquer
    // componente de dentro do diálogo tratar a tecla por conta própria.
    document.addEventListener('keydown', handleKeyDown, true);

    // A página atrás não rola enquanto o diálogo esta aberto — rolar o que
    // esta sob o véu e desorientador, e no celular e o que faz a página
    // "pular" ao fechar.
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      if (trigger instanceof HTMLElement) {
        trigger.focus();
      }
    };
  }, [open]);

  const onOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      // Só o clique no próprio véu. Sem esta conferência, arrastar uma
      // seleção de texto de dentro do diálogo para fora o fecharia.
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onCloseRef.current();
      }
    },
    [closeOnOverlayClick],
  );

  return { ref, onOverlayClick };
}

/** Manda o foco para o primeiro campo, ou para o próprio diálogo. */
function focusFirst(node: HTMLElement): void {
  const first = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].find(isVisible);

  (first ?? node).focus();
}

/**
 * Elemento escondido não recebe foco.
 *
 * `offsetParent` e `null` para quem esta com `display: none` — e o teste
 * barato que cobre o caso comum de um bloco escondido dentro do diálogo.
 */
function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null || element.getClientRects().length > 0;
}
