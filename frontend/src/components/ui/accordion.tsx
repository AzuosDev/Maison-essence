import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '@/lib/cx';
import styles from './accordion.module.css';

/**
 * A sanfona: perguntas frequentes, detalhes do produto, blocos do pedido.
 *
 * Os gatilhos são `<button>` dentro de um título, e não `<div onClick>`:
 * assim entram na ordem do Tab, respondem a Enter e a Espaço e são
 * anunciados com o estado ("Entrega, recolhido"). O `aria-expanded` e o que
 * carrega esse estado.
 *
 * Além do Tab, as setas movem entre os gatilhos — e o que a convenção define
 * para o padrão `accordion` — e `Home`/`End` vão para o primeiro e o último.
 * O tratador fica em cada gatilho, e não no container: dentro de um painel
 * aberto, as setas precisam continuar rolando a página.
 */

/** Referência estável: um literal no valor padrão remonta a cada render. */
const NONE: readonly string[] = [];

interface AccordionContextValue {
  baseId: string;
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion(): AccordionContextValue {
  const context = useContext(AccordionContext);

  if (!context) {
    throw new Error('AccordionItem precisa estar dentro de <Accordion>.');
  }

  return context;
}

export interface AccordionProps {
  /**
   * Mais de um item aberto ao mesmo tempo.
   *
   * Desligado por padrão: numa lista de perguntas, abrir uma e fechar a
   * anterior mantem a resposta na tela sem obrigar a rolar.
   */
  multiple?: boolean;
  /** Os itens que já começam abertos. */
  defaultOpen?: readonly string[];
  className?: string | undefined;
  children: ReactNode;
}

export function Accordion({
  multiple = false,
  defaultOpen = NONE,
  className,
  children,
}: AccordionProps) {
  const baseId = useId();
  const [open, setOpen] = useState<string[]>(() => [...defaultOpen]);

  const isOpen = useCallback((value: string) => open.includes(value), [open]);

  const toggle = useCallback(
    (value: string) => {
      setOpen((current) => {
        if (current.includes(value)) {
          return current.filter((item) => item !== value);
        }

        return multiple ? [...current, value] : [value];
      });
    },
    [multiple],
  );

  const context = useMemo(() => ({ baseId, isOpen, toggle }), [baseId, isOpen, toggle]);

  return (
    <AccordionContext.Provider value={context}>
      <div data-accordion="" className={cx(styles.accordion, className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export type AccordionItemProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  value: string;
  title: ReactNode;
  disabled?: boolean;
  /** O nível do título no documento. */
  as?: 'h2' | 'h3' | 'h4';
};

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { value, title, disabled, as: Heading = 'h3', className, children, ...props },
  ref,
) {
  const { baseId, isOpen, toggle } = useAccordion();
  const open = isOpen(value);

  const triggerId = `${baseId}-trigger-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  return (
    <div ref={ref} className={cx(styles.item, className)} {...props}>
      <Heading>
        <button
          type="button"
          id={triggerId}
          data-accordion-trigger=""
          disabled={disabled}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            toggle(value);
          }}
          onKeyDown={(event) => {
            const next = siblingFor(event);

            if (next) {
              event.preventDefault();
              next.focus();
            }
          }}
          className={styles.trigger}
        >
          {title}
          <span className={styles.chevron} aria-hidden="true" />
        </button>
      </Heading>

      {/* Desmontado quando fechado, e nao escondido com CSS: conteudo
          escondido que continua no DOM e lido por leitor de tela e
          alcancado pelo Tab. */}
      {open ? (
        <section id={panelId} aria-labelledby={triggerId} className={styles.panel}>
          {children}
        </section>
      ) : null}
    </div>
  );
});

/** O gatilho que a tecla pede, ou `null` quando a tecla não e de navegação. */
function siblingFor(event: KeyboardEvent<HTMLButtonElement>): HTMLButtonElement | null {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

  if (!keys.includes(event.key)) {
    return null;
  }

  const root = event.currentTarget.closest('[data-accordion]');

  if (!root) {
    return null;
  }

  const triggers = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-accordion-trigger]:not([disabled])'),
  ];
  const index = triggers.indexOf(event.currentTarget);

  if (index === -1) {
    return null;
  }

  if (event.key === 'Home') {
    return triggers[0] ?? null;
  }

  if (event.key === 'End') {
    return triggers[triggers.length - 1] ?? null;
  }

  const step = event.key === 'ArrowDown' ? 1 : -1;

  return triggers[(index + step + triggers.length) % triggers.length] ?? null;
}
