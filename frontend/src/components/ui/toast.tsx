import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import styles from './toast.module.css';

/**
 * O aviso passageiro.
 *
 * Tres partes: `Toast` desenha um aviso, `ToastProvider` guarda a fila e a
 * desenha por portal, e `useToast` e como o resto da aplicacao pede um.
 *
 * A regra que decide o que vira toast: aviso que o cliente pode perder sem
 * prejuizo. "Produto adicionado a sacola" cabe aqui — se ele nao vir, a
 * sacola com um item a mais conta a mesma coisa. "Nao foi possivel enviar o
 * pedido" nao cabe: isso fica na tela, ao lado do botao, ate ser resolvido.
 */

export type ToastVariant = 'info' | 'success' | 'danger';

/**
 * O atalho no rodape do aviso: "Ver a sacola".
 *
 * E um `onSelect`, e nao um endereco, e a razao e de arquitetura: o
 * `ToastProvider` fica **por fora** do `RouterProvider` (ver `app/App.tsx`),
 * entao um `<Link>` desenhado aqui dentro nao encontraria contexto de
 * roteador nenhum e derrubaria o primeiro aviso que tentasse usa-lo. Quem
 * pede o toast esta dentro do router e tem `useNavigate` a mao; este
 * primitivo continua sem saber que rotas existem, que e como o resto de
 * `components/ui` funciona.
 */
export interface ToastAction {
  label: string;
  onSelect: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Quanto tempo fica na tela. `0` para so sair no clique. */
  duration?: number;
  action?: ToastAction;
}

/**
 * Cinco segundos: o bastante para ler duas linhas sem pressa, pouco o
 * bastante para nao acumular avisos na tela de quem esta clicando rapido.
 */
const DEFAULT_DURATION_MS = 5000;

interface ToastEntry extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error('useToast precisa estar dentro de um <ToastProvider>.');
  }

  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  // Os temporizadores ficam num ref, e nao no estado: eles nao desenham
  // nada, e guarda-los no estado faria a fila renderizar de novo a cada
  // agendamento.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = options.duration ?? DEFAULT_DURATION_MS;

      setEntries((current) => [...current, { ...options, id }]);

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => {
            dismiss(id);
          }, duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  // Ao desmontar, nenhum temporizador fica de pe tentando mexer num estado
  // que nao existe mais. O ref e lido dentro do efeito, e nao no corpo do
  // componente: `.current` durante o render e um valor que o React nao
  // garante estavel.
  useEffect(() => {
    const scheduled = timers.current;

    return () => {
      for (const timer of scheduled.values()) {
        clearTimeout(timer);
      }

      scheduled.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {entries.length > 0
        ? createPortal(
            // Uma `<section>` com rotulo — ou seja, um marco de navegacao —
            // para que quem navega por marcos consiga chegar ate os avisos.
            // Cada aviso tem o seu proprio `role`.
            <section className={styles.viewport} aria-label="Avisos">
              {entries.map((entry) => (
                <Toast
                  key={entry.id}
                  title={entry.title}
                  description={entry.description}
                  variant={entry.variant}
                  action={entry.action}
                  onSelectAction={() => {
                    dismiss(entry.id);
                  }}
                  onDismiss={() => {
                    dismiss(entry.id);
                  }}
                />
              ))}
            </section>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export type ToastProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  title: string;
  description?: string | undefined;
  variant?: ToastVariant | undefined;
  /** O link do rodape do aviso: "Ver a sacola". */
  action?: ToastAction | undefined;
  /**
   * O atalho foi usado.
   *
   * O aviso sai da tela junto: deixa-lo anunciando que o item entrou na
   * sacola por cima da propria sacola aberta e dar a mesma noticia duas
   * vezes, com uma delas cobrindo a outra.
   */
  onSelectAction?: (() => void) | undefined;
  /** Sem ele, o aviso nao mostra o X — util so no styleguide. */
  onDismiss?: (() => void) | undefined;
  closeLabel?: string;
};

export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  {
    title,
    description,
    variant = 'info',
    action,
    onSelectAction,
    onDismiss,
    closeLabel = 'Dispensar',
    className,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      // O erro interrompe a leitura; o resto espera a pausa. Anunciar um
      // "produto adicionado" por cima do que o cliente esta lendo e pior do
      // que atrasa-lo em dois segundos.
      role={variant === 'danger' ? 'alert' : 'status'}
      aria-live={variant === 'danger' ? 'assertive' : 'polite'}
      className={cx(styles.toast, styles[variant], className)}
      {...props}
    >
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {description ? <p className={styles.description}>{description}</p> : null}

        {action ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              action.onSelect();
              onSelectAction?.();
            }}
          >
            {action.label}
          </button>
        ) : null}
      </div>

      {onDismiss ? (
        <button type="button" onClick={onDismiss} className={styles.close} aria-label={closeLabel}>
          <span className={styles.closeIcon} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
});
