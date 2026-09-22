import { useCallback, useEffect, useRef, type RefObject } from 'react';

/**
 * O comportamento que o modal e a gaveta tem em comum.
 *
 * Sao tres obrigacoes, e nenhuma e detalhe: quem abre um dialogo com o
 * teclado precisa conseguir sair dele com o teclado, e quem usa leitor de
 * tela precisa que o foco esteja *dentro* do dialogo — senao a leitura
 * continua na pagina atras do veu, que visualmente nao existe mais.
 *
 * 1. **Prender o foco.** O Tab circula entre os elementos focaveis do
 *    dialogo e nao escapa para a pagina.
 * 2. **Fechar no Escape.** Em qualquer lugar do dialogo.
 * 3. **Devolver o foco.** Ao fechar, o foco volta para o elemento que abriu.
 *    Sem isso, o Tab seguinte recomeca do inicio do documento e quem estava
 *    no meio de um formulario se perde.
 *
 * O hook esta separado dos dois componentes porque duplicar isto seria
 * duplicar a chance de esquecer um dos tres.
 */

/** O que o navegador considera alcancavel pelo Tab, na ordem do documento. */
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
   * Fecha ao clicar no veu. Ligado por padrao; o passo de checkout que nao
   * pode ser abandonado no meio desliga.
   */
  closeOnOverlayClick?: boolean;
}

interface Dialog<T extends HTMLElement> {
  /** Vai no elemento que contem o dialogo — e dentro dele que o foco fica. */
  ref: RefObject<T>;
  /** Vai no veu: cuida do clique fora. */
  onOverlayClick: (event: React.MouseEvent) => void;
}

export function useDialog<T extends HTMLElement>({
  open,
  onClose,
  closeOnOverlayClick = true,
}: DialogOptions): Dialog<T> {
  const ref = useRef<T>(null);

  // O callback vive num ref para que o efeito dependa so de `open`. Se
  // dependesse de `onClose`, um pai que recria a funcao a cada render faria
  // o efeito rodar de novo — e o foco saltaria para o primeiro campo no meio
  // da digitacao.
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
    // porque o foco so se move na linha seguinte.
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
        // Dialogo sem nada focavel: o foco fica no proprio container, que
        // tem `tabIndex={-1}`, em vez de vazar para a pagina.
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

      // O Tab que sairia pela frente volta para o comeco, e o Shift+Tab que
      // sairia por tras vai para o fim. O `!node.contains` cobre o caso de o
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
    // componente de dentro do dialogo tratar a tecla por conta propria.
    document.addEventListener('keydown', handleKeyDown, true);

    // A pagina atras nao rola enquanto o dialogo esta aberto — rolar o que
    // esta sob o veu e desorientador, e no celular e o que faz a pagina
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
      // So o clique no proprio veu. Sem esta conferencia, arrastar uma
      // selecao de texto de dentro do dialogo para fora o fecharia.
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onCloseRef.current();
      }
    },
    [closeOnOverlayClick],
  );

  return { ref, onOverlayClick };
}

/** Manda o foco para o primeiro campo, ou para o proprio dialogo. */
function focusFirst(node: HTMLElement): void {
  const first = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].find(isVisible);

  (first ?? node).focus();
}

/**
 * Elemento escondido nao recebe foco.
 *
 * `offsetParent` e `null` para quem esta com `display: none` — e o teste
 * barato que cobre o caso comum de um bloco escondido dentro do dialogo.
 */
function isVisible(element: HTMLElement): boolean {
  return element.offsetParent !== null || element.getClientRects().length > 0;
}
