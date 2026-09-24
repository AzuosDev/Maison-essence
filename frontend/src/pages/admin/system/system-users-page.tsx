import { useMemo, useState } from 'react';
import { ConfirmDialog, OneTimeSecret, PlusIcon, SearchIcon, UsersTable } from '@/components/admin';
import { Button, Input, Modal, useToast } from '@/components/ui';
import {
  generateTemporaryPassword,
  isMissingRoute,
  useAdminUser,
  useCreateUser,
  useResetPassword,
  useRevokeSessions,
  useSetUserStatus,
  useUpdateUser,
  useUsers,
  type SystemUser,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { UserFormDialog, type UserFormValues } from './user-form-dialog';
import styles from './system-users-page.module.css';

/**
 * As contas que entram no painel.
 *
 * ## A senha temporária existe uma vez
 *
 * E o critério que define esta tela. Na criação, o painel gera a senha
 * (`generateTemporaryPassword`), manda no corpo da chamada e mostra o que
 * gerou — o servidor guarda só o hash argon2. No reset, quem gera e o
 * servidor e a senha volta no corpo da resposta, também uma vez.
 *
 * Nos dois caminhos ela vai para o estado local desta tela e para mais lugar
 * nenhum: não entra no cache do React Query, não vai para a URL, não e
 * gravada. Fechar o diálogo a apaga, e o único jeito de ter outra e resetar
 * de novo — o que e barato, e e exatamente por isso que não há um lugar onde
 * ela fique guardada.
 *
 * ## Tudo o que destroi passa por uma confirmação que nomeia o alvo
 *
 * Desativar, resetar senha e encerrar sessões atingem outra pessoa, no meio
 * do expediente dela. As três param no `ConfirmDialog`, que mostra o e-mail
 * do alvo em destaque — numa tabela de linhas parecidas, conferir o endereço
 * e o que separa "desativar o acesso antigo" de "desativar quem esta
 * atendendo agora".
 *
 * ## O interruptor e otimista, e o erro aqui e comum
 *
 * `useSetUserStatus` aplica a mudanca no cache antes da resposta. O servidor
 * recusa por dois motivos reais — "você não pode desativar a si mesmo" e
 * "este e o último administrador ativo" —, e quando recusa o cache volta e o
 * aviso traz a frase do servidor, que já vem escrita para ser lida.
 *
 * ## A busca e no cliente
 *
 * `GET /users` devolve a lista inteira, sem paginação nem filtro: e uma
 * decisão do backend que combina com o tamanho do problema — uma loja tem
 * três a dez contas. Mandar `?q=` para uma rota que o ignora criaria um
 * filtro que parece funcionar e não funciona.
 */
export default function SystemUsersPage() {
  const me = useAdminUser();
  const { toast } = useToast();

  const { data: users, isLoading, isError, error } = useUsers();

  const create = useCreateUser();
  const update = useUpdateUser();
  const setStatus = useSetUserStatus();
  const resetPassword = useResetPassword();
  const revoke = useRevokeSessions();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUser | undefined>();
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);

  const visible = useMemo(() => filterUsers(users ?? [], search), [users, search]);

  const openCreate = (): void => {
    setEditing(undefined);
    create.reset();
    setFormOpen(true);
  };

  const openEdit = (user: SystemUser): void => {
    setEditing(user);
    update.reset();
    setFormOpen(true);
  };

  const submitForm = (values: UserFormValues): void => {
    if (editing !== undefined) {
      update.mutate(
        { id: editing.id, input: values },
        {
          onSuccess: (saved) => {
            setFormOpen(false);
            toast({ title: `Cadastro de ${saved.name} atualizado.`, variant: 'success' });
          },
        },
      );

      return;
    }

    // A senha e gerada aqui, no envio, e não no estado do formulário: se a
    // chamada falhar por e-mail repetido, a próxima tentativa leva uma senha
    // nova em vez de reusar a que já saiu daqui uma vez.
    const temporaryPassword = generateTemporaryPassword();

    create.mutate(
      { ...values, temporaryPassword },
      {
        onSuccess: (saved) => {
          setFormOpen(false);
          setSecret({ password: temporaryPassword, email: saved.email, reason: 'created' });
        },
      },
    );
  };

  const closeConfirm = (): void => {
    setConfirm(null);
  };

  const runConfirmed = (): void => {
    if (confirm === null) {
      return;
    }

    const { kind, user } = confirm;

    if (kind === 'status') {
      setStatus.mutate(
        { id: user.id, isActive: !user.isActive },
        {
          onSuccess: () => {
            closeConfirm();
            toast({
              title: user.isActive
                ? `${user.name} foi desativado.`
                : `${user.name} voltou a ter acesso.`,
              ...(user.isActive ? { description: 'As sessões abertas dele caíram na hora.' } : {}),
              variant: 'success',
            });
          },
          onError: (failure) => {
            closeConfirm();
            toast({
              title: 'Não deu para mudar o status',
              description: errorMessage(failure),
              variant: 'danger',
            });
          },
        },
      );

      return;
    }

    if (kind === 'reset') {
      resetPassword.mutate(user.id, {
        onSuccess: (result) => {
          closeConfirm();
          setSecret({
            password: result.temporaryPassword,
            email: result.user.email,
            reason: 'reset',
          });
        },
        onError: (failure) => {
          closeConfirm();
          toast({
            title: 'Não deu para resetar a senha',
            description: errorMessage(failure),
            variant: 'danger',
          });
        },
      });

      return;
    }

    revoke.mutate(user.id, {
      onSuccess: () => {
        closeConfirm();
        toast({ title: `As sessões de ${user.name} foram encerradas.`, variant: 'success' });
      },
      onError: (failure) => {
        closeConfirm();

        // O 404 aqui não e falha: a rota não existe. O aviso manda para a
        // ação que produz o mesmo efeito hoje, em vez de pedir que se tente
        // de novo um caminho que nunca vai responder.
        toast({
          title: isMissingRoute(failure)
            ? 'Esta ação ainda não existe na API'
            : 'Não deu para encerrar as sessões',
          description: isMissingRoute(failure)
            ? 'Use "Resetar senha": ela derruba todas as sessões desta pessoa junto com a troca.'
            : errorMessage(failure),
          variant: 'danger',
          duration: 8000,
        });
      },
    });
  };

  const confirming = setStatus.isPending || resetPassword.isPending || revoke.isPending;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Input
          label="Buscar por nome ou e-mail"
          hideLabel
          block
          type="search"
          placeholder="Buscar por nome ou e-mail"
          prefix={<SearchIcon />}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          className={styles.search}
        />

        <Button type="button" onClick={openCreate}>
          <PlusIcon />
          Novo acesso
        </Button>
      </div>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : (
        <UsersTable
          users={visible}
          isLoading={isLoading}
          currentUserId={me?.id}
          onEdit={openEdit}
          onResetPassword={(user) => {
            setConfirm({ kind: 'reset', user });
          }}
          onRevokeSessions={(user) => {
            setConfirm({ kind: 'revoke', user });
          }}
          onToggleStatus={(user) => {
            setConfirm({ kind: 'status', user });
          }}
        />
      )}

      <UserFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
        }}
        user={editing}
        onSubmit={submitForm}
        isPending={editing === undefined ? create.isPending : update.isPending}
        error={editing === undefined ? create.error : update.error}
      />

      {confirm === null ? null : (
        <ConfirmDialog
          open
          onClose={closeConfirm}
          onConfirm={runConfirmed}
          target={confirm.user.email}
          loading={confirming}
          {...copyFor(confirm)}
        />
      )}

      {/*
        O dialogo da senha nao fecha clicando fora: a senha some com ele, e um
        clique ao lado do quadro nao pode ser o gesto que a perde.
      */}
      <Modal
        open={secret !== null}
        onClose={() => {
          setSecret(null);
        }}
        closeOnOverlayClick={false}
        title={secret?.reason === 'reset' ? 'Senha resetada' : 'Acesso criado'}
        description="Entregue esta senha para a pessoa. No primeiro login o painel manda troca-lá."
      >
        {secret === null ? null : (
          <OneTimeSecret secret={secret.password} label={`Senha temporária de ${secret.email}`} />
        )}
      </Modal>
    </div>
  );
}

/* ---- Apoio --------------------------------------------------------------- */

interface Confirmation {
  kind: 'status' | 'reset' | 'revoke';
  user: SystemUser;
}

interface Secret {
  password: string;
  email: string;
  reason: 'created' | 'reset';
}

interface ConfirmCopy {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'danger' | 'neutral';
}

/** O texto de cada confirmação. Sempre diz o que acontece com a pessoa. */
function copyFor({ kind, user }: Confirmation): ConfirmCopy {
  if (kind === 'status') {
    return user.isActive
      ? {
          title: 'Desativar este acesso?',
          description: `${user.name} perde o painel agora: as sessões abertas caem na próxima ação dele e o login passa a ser recusado. O cadastro continua aqui e pode ser reativado.`,
          confirmLabel: 'Desativar',
          tone: 'danger',
        }
      : {
          title: 'Reativar este acesso?',
          description: `${user.name} volta a entrar no painel com a senha que já tinha.`,
          confirmLabel: 'Reativar',
          tone: 'neutral',
        };
  }

  if (kind === 'reset') {
    return {
      title: 'Resetar a senha?',
      description: `A senha atual de ${user.name} para de funcionar, as sessões abertas caem e o painel gera uma temporária — que aparece uma vez só, na tela seguinte.`,
      confirmLabel: 'Resetar senha',
      tone: 'danger',
    };
  }

  return {
    title: 'Encerrar todas as sessões?',
    description: `${user.name} cai do painel em todos os aparelhos e precisa entrar de novo. A senha continua a mesma.`,
    confirmLabel: 'Encerrar sessões',
    tone: 'danger',
  };
}

/**
 * A busca: nome ou e-mail, sem diferenciar maiúsculas.
 *
 * Exportada para o teste. Um `includes` resolve uma lista de dez contas, e
 * uma busca tolerante a erro de digitação seria código para um problema que
 * esta tela não tem.
 */
export function filterUsers(users: readonly SystemUser[], search: string): SystemUser[] {
  const term = search.trim().toLowerCase();

  if (term === '') {
    return [...users];
  }

  return users.filter(
    (user) => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
  );
}
