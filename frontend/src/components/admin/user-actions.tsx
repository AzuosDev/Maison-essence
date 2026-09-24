import { KeyIcon, PencilIcon, PowerIcon } from './admin-icons';
import { RowMenu, type RowMenuItem } from './row-menu';

/**
 * As ações de uma linha da tabela de usuários.
 *
 * A mecânica do menu — abrir, fechar por clique fora, por Escape ou por
 * escolha, devolver o foco — mora em `RowMenu`, que a tabela de produtos usa
 * também. O que fica aqui e o que só vale para usuários: **quais** são as
 * ações, em que ordem, e qual delas some.
 *
 * "Desativar" e a única cuja consequência atinge outra pessoa — quem estiver
 * logado cai na próxima ação dele —, e por isso vem por último, em vermelho,
 * separada do resto por um filete.
 */

export interface UserActionsProps {
  /** Vai no rótulo do botão: "Ações de Rayane Souza". */
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
   * opção para depois explicar que ela não vale seria um caminho que só
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
    { label: 'Encerrar todas as sessões', icon: PowerIcon, onSelect: onRevokeSessions },
  ];

  if (!isSelf) {
    items.push({
      label: isActive ? 'Desativar' : 'Ativar',
      icon: PowerIcon,
      onSelect: onToggleStatus,
      // Reativar não atinge ninguém: só a retirada do acesso e vermelha.
      tone: isActive ? 'danger' : 'default',
      separated: true,
    });
  }

  return <RowMenu label={userName} items={items} />;
}
