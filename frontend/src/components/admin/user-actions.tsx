import { KeyIcon, PencilIcon, PowerIcon } from './admin-icons';
import { RowMenu, type RowMenuItem } from './row-menu';

/**
 * As acoes de uma linha da tabela de usuarios.
 *
 * A mecanica do menu — abrir, fechar por clique fora, por Escape ou por
 * escolha, devolver o foco — mora em `RowMenu`, que a tabela de produtos usa
 * tambem. O que fica aqui e o que so vale para usuarios: **quais** sao as
 * acoes, em que ordem, e qual delas some.
 *
 * "Desativar" e a unica cuja consequencia atinge outra pessoa — quem estiver
 * logado cai na proxima acao dele —, e por isso vem por ultimo, em vermelho,
 * separada do resto por um filete.
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
  const items: RowMenuItem[] = [
    { label: 'Editar cadastro', icon: PencilIcon, onSelect: onEdit },
    { label: 'Resetar senha', icon: KeyIcon, onSelect: onResetPassword },
    { label: 'Encerrar todas as sessoes', icon: PowerIcon, onSelect: onRevokeSessions },
  ];

  if (!isSelf) {
    items.push({
      label: isActive ? 'Desativar' : 'Ativar',
      icon: PowerIcon,
      onSelect: onToggleStatus,
      // Reativar nao atinge ninguem: so a retirada do acesso e vermelha.
      tone: isActive ? 'danger' : 'default',
      separated: true,
    });
  }

  return <RowMenu label={userName} items={items} />;
}
