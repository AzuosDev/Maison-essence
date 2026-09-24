import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/cx';
import { MoreIcon } from './admin-icons';
import styles from './row-menu.module.css';

/**
 * O menu de ações de uma linha de tabela.
 *
 * ## Por que não são três botões soltos
 *
 * Três botões por linha somam sessenta alvos de toque numa tabela de vinte
 * produtos, e o celular não tem largura para eles. Um `<select>` seria lido
 * como "escolha um valor", e o que esta aqui são ações — uma delas
 * destrutiva.
 *
 * Então e um botão que abre uma lista de botões. O fechamento cobre os três
 * caminhos de saída: clique fora, Escape, e a escolha de um item. O foco
 * volta para o botão que abriu, porque quem navega por teclado precisa
 * continuar de onde estava e não no topo do documento.
 *
 * ## A ação destrutiva vem por último, e separada
 *
 * `tone: 'danger'` pinta em vermelho e `separated` a afasta do resto com um
 * filete. Não e enfeite: o menu abre sempre no mesmo lugar, as linhas se
 * parecem, e a distância e o que impede o dedo de excluir a linha errada.
 *
 * ## O que este componente não decide
 *
 * Quais ações existem. Ele recebe a lista pronta, e quem monta e a tela — que
 * e quem sabe quais delas o papel de quem esta olhando pode fazer.
 */

/**
 * Um item do menu.
 *
 * Ou `to`, ou `onSelect`, nunca os dois. O item que leva a outro endereço e
 * um `<a>` e o item que executa uma ação e um `<button>` — a mesma distinção
 * que separa `Button` de `ButtonLink` no design system, e pelas mesmas
 * razões: só o link abre em nova aba com o meio do mouse, e só o botão e
 * anunciado como botão.
 */
export type RowMenuItem = {
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Vermelho, para o que não se desfaz. */
  tone?: 'default' | 'danger';
  /** Um filete acima, para afastar do grupo anterior. */
  separated?: boolean;
  disabled?: boolean;
} & ({ to: string; onSelect?: never } | { to?: never; onSelect: () => void });

export interface RowMenuProps {
  /** Vai no rótulo do botão: "Ações de Asad 100ml". */
  label: string;
  items: readonly RowMenuItem[];
}

export function RowMenu({ label, items }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.container} ref={container}>
      <button
        type="button"
        ref={trigger}
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Ações de ${label}`}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <MoreIcon />
      </button>

      {open ? (
        <ul className={styles.menu}>
          {items.map((item) => {
            const className = cx(styles.item, item.tone === 'danger' && styles.danger);
            const content = (
              <>
                {item.icon === undefined ? null : <item.icon className={styles.itemIcon} />}
                {item.label}
              </>
            );

            return (
              <li
                key={item.label}
                className={item.separated === true ? styles.separated : undefined}
              >
                {item.to === undefined ? (
                  <button
                    type="button"
                    disabled={item.disabled}
                    className={className}
                    onClick={() => {
                      // Executa e fecha: nenhum item deixa a lista aberta atrás
                      // de si, nem quando abre um diálogo por cima.
                      setOpen(false);
                      item.onSelect();
                    }}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    to={item.to}
                    className={className}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
