import { useEffect, useRef, useState } from 'react';
import { KeyIcon, MoreIcon, PencilIcon, PowerIcon } from './admin-icons';
import styles from './user-actions.module.css';

/**
 * O menu de acoes de uma linha da tabela de usuarios.
 *
 * ## Por que nao e um `<select>` nem tres botoes soltos
 *
 * Tres botoes por linha somam doze alvos de toque numa tabela de quatro
 * contas, e o celular nao tem largura para eles. Um `<select>` seria lido
 * como "escolha um valor", e o que esta aqui sao acoes — uma delas
 * destrutiva.
 *
 * Entao e um botao que abre uma lista de botoes. O fechamento cobre os tres
 * caminhos de saida: clique fora, Escape, e a escolha de um item. O foco
 * volta para o botao que abriu, porque quem navega por teclado precisa
 * continuar de onde estava e nao no topo do documento.
 *
 * ## A acao destrutiva vem por ultimo, e em vermelho
 *
 * "Desativar" fica separada do resto por um filete. Nao e enfeite: e a
 * unica entrada da lista cuja consequencia atinge outra pessoa — quem esta
 * logado cai na proxima acao dele.
 */

export interface UserActionsProps {
  /** Vai no rotulo do botao: "Acoes de Rayane Souza". */
  userName: string;
  onEdit: () => void;
  onResetPassword: () => void;
  onRevokeSessions: () => void;
  onToggleStatus: () => void;
  isActive: boolean;
  /**
   * A conta de quem esta usando o painel.
   *
   * Desativar a si mesmo e recusado pelo servidor com um 409, e mostrar a
   * opcao para depois explicar que ela nao vale seria um caminho que so
   * existe para terminar em erro.
   */
  isSelf?: boolean;
}

export function UserActions({
  userName,
  onEdit,
  onResetPassword,
  onRevokeSessions,
  onToggleStatus,
  isActive,
  isSelf = false,
}: UserActionsProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (): void => {
      setOpen(false);
      trigger.current?.focus();
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /** Executa e fecha: nenhum item do menu deixa a lista aberta atras de si. */
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className={styles.container} ref={container}>
      <button
        type="button"
        ref={trigger}
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Acoes de ${userName}`}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <MoreIcon />
      </button>

      {open ? (
        <ul className={styles.menu}>
          <li>
            <button type="button" className={styles.item} onClick={run(onEdit)}>
              <PencilIcon className={styles.itemIcon} />
              Editar cadastro
            </button>
          </li>

          <li>
            <button type="button" className={styles.item} onClick={run(onResetPassword)}>
              <KeyIcon className={styles.itemIcon} />
              Resetar senha
            </button>
          </li>

          <li>
            <button type="button" className={styles.item} onClick={run(onRevokeSessions)}>
              <PowerIcon className={styles.itemIcon} />
              Encerrar todas as sessoes
            </button>
          </li>

          {isSelf ? null : (
            <li className={styles.separated}>
              <button
                type="button"
                className={isActive ? styles.danger : styles.item}
                onClick={run(onToggleStatus)}
              >
                <PowerIcon className={styles.itemIcon} />
                {isActive ? 'Desativar' : 'Ativar'}
              </button>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
