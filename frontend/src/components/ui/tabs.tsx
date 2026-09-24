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
import styles from './tabs.module.css';

/**
 * As abas.
 *
 * O teclado segue o que a convenção de acessibilidade define para o padrão
 * `tablist`, e são duas regras que juntas fazem a diferença:
 *
 * - **Setas trocam de aba, Tab sai da fila.** Dentro da lista, só a aba
 *   selecionada esta na ordem do Tab (`tabIndex` 0; as outras, -1). E o que
 *   impede que uma página com seis abas exija seis Tabs para chegar ao
 *   conteúdo.
 * - **A seleção acompanha o foco.** Setas já trocam o painel, sem precisar
 *   de Enter. E o comportamento esperado quando os paineis são leves, como
 *   são aqui.
 *
 * `Home` e `End` vão para a primeira e a última, e a fila circula: seta a
 * direita na última volta para a primeira.
 *
 * O tratador de teclado fica em cada aba, e não na lista. Além de ser onde o
 * foco esta de fato, e o que mantem a lista um container sem comportamento —
 * um `role="tablist"` que escuta teclas precisaria ser focável, e não deve
 * ser.
 */

interface TabsContextValue {
  baseId: string;
  value: string;
  select: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error('Tab, TabList e TabPanel precisam estar dentro de <Tabs>.');
  }

  return context;
}

export interface TabsProps {
  /** Controlado por quem usa. Junto de `onChange`. */
  value?: string;
  /** Não controlado: a aba que abre selecionada. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string | undefined;
  children: ReactNode;
}

export function Tabs({ value, defaultValue = '', onChange, className, children }: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue);

  const current = value ?? internal;

  const select = useCallback(
    (next: string) => {
      // O estado interno e atualizado mesmo no modo controlado: se quem
      // controla decidir ignorar a troca, o componente volta para o valor
      // dele no próximo render, e não fica com dois valores em disputa.
      setInternal(next);
      onChange?.(next);
    },
    [onChange],
  );

  const context = useMemo(() => ({ baseId, value: current, select }), [baseId, current, select]);

  return (
    <TabsContext.Provider value={context}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export type TabListProps = ComponentPropsWithoutRef<'div'> & {
  /** O que esta sendo escolhido. Obrigatório: a lista precisa de nome. */
  'aria-label': string;
};

export const TabList = forwardRef<HTMLDivElement, TabListProps>(function TabList(
  { className, ...props },
  ref,
) {
  return <div ref={ref} role="tablist" className={cx(styles.list, className)} {...props} />;
});

export type TabProps = ComponentPropsWithoutRef<'button'> & {
  value: string;
};

export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { value, className, onFocus, onClick, onKeyDown, ...props },
  ref,
) {
  const { baseId, value: current, select } = useTabs();
  const selected = current === value;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    onKeyDown?.(event);

    const next = siblingFor(event);

    if (next) {
      event.preventDefault();
      // Focar já seleciona: o `onFocus` da aba vizinha cuida disso.
      next.focus();
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      // Só a selecionada esta na ordem do Tab. As outras se alcancam pelas
      // setas, que e como o padrão manda.
      tabIndex={selected ? 0 : -1}
      onFocus={(event) => {
        onFocus?.(event);
        select(value);
      }}
      onClick={(event) => {
        onClick?.(event);
        select(value);
      }}
      onKeyDown={handleKeyDown}
      className={cx(styles.tab, className)}
      {...props}
    />
  );
});

export type TabPanelProps = ComponentPropsWithoutRef<'div'> & {
  value: string;
};

export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
  { value, className, ...props },
  ref,
) {
  const { baseId, value: current } = useTabs();

  if (current !== value) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      // O painel entra na ordem do Tab: depois de escolher a aba, o próximo
      // Tab leva ao conteúdo dela, e não para fora do bloco.
      tabIndex={0}
      className={cx(styles.panel, className)}
      {...props}
    />
  );
});

/**
 * A aba que a tecla pede, ou `null` quando a tecla não e de navegação.
 *
 * As irmas são lidas do DOM, e não de uma lista em estado: as abas podem ser
 * condicionais, e o DOM e a única fonte que já sabe quais existem agora e
 * quais estão desabilitadas.
 */
function siblingFor(event: KeyboardEvent<HTMLButtonElement>): HTMLButtonElement | null {
  const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

  if (!keys.includes(event.key)) {
    return null;
  }

  const list = event.currentTarget.closest('[role="tablist"]');

  if (!list) {
    return null;
  }

  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')];
  const index = tabs.indexOf(event.currentTarget);

  if (index === -1) {
    return null;
  }

  if (event.key === 'Home') {
    return tabs[0] ?? null;
  }

  if (event.key === 'End') {
    return tabs[tabs.length - 1] ?? null;
  }

  // A fila circula nas duas pontas.
  const step = event.key === 'ArrowRight' ? 1 : -1;

  return tabs[(index + step + tabs.length) % tabs.length] ?? null;
}
