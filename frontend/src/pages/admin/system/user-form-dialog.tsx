import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Modal, Select } from '@/components/ui';
import { ROLE_LABELS, type SystemUser } from '@/features/admin';
import { USER_ROLES } from '@/features/auth';
import { errorMessage } from '@/lib/http';
import styles from './user-form-dialog.module.css';

/**
 * Criar e editar um usuário do painel.
 *
 * ## Um diálogo para os dois, e não dois formulários
 *
 * Os campos são os mesmos — nome, e-mail, papel — e o que muda e o título, o
 * botão e o que acontece depois. Duplicar isso significaria que uma regra
 * nova ("e-mail no máximo 160") entraria em um dos dois e seria esquecida no
 * outro.
 *
 * A senha não e campo de nenhum dos dois. Na criação ela e gerada pelo
 * painel e mostrada depois que o servidor aceita — ver
 * `temporary-password.ts`; na edição ela tem rota própria, porque trocar
 * senha e uma ação e não a edição de um campo.
 *
 * ## Diálogo, e não página
 *
 * Três campos não justificam sair da lista e perder o contexto. E o
 * contrário do formulário de produto, que tem variantes, imagens e
 * categorias e precisa da página inteira.
 */

const schema = z.object({
  name: z.string().trim().min(2, 'Escreva o nome completo.').max(120, 'Nome longo demais.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Esse e-mail não parece válido.')
    .max(160, 'E-mail longo demais.'),
  role: z.enum([USER_ROLES.SUPER_ADMIN, USER_ROLES.OWNER, USER_ROLES.STAFF]),
});

export type UserFormValues = z.output<typeof schema>;

/**
 * Os papéis, do menor alcance para o maior.
 *
 * Nesta ordem de propósito: quem escolhe lê de cima para baixo e encontra
 * primeiro o papel que serve para a maioria dos casos — alguém que vai
 * ajudar a responder no WhatsApp. Colocar "Administrador" no topo o
 * transformaria no caminho de menor esforço.
 */
const ROLE_OPTIONS = [
  { value: USER_ROLES.STAFF, label: `${ROLE_LABELS.STAFF} — pedidos, sem preços` },
  { value: USER_ROLES.OWNER, label: `${ROLE_LABELS.OWNER} — catálogo, pedidos e preços` },
  { value: USER_ROLES.SUPER_ADMIN, label: `${ROLE_LABELS.SUPER_ADMIN} — a loja e o sistema` },
];

export interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Ausente na criação. Presente, o diálogo edita este registro. */
  user?: SystemUser | undefined;
  onSubmit: (values: UserFormValues) => void;
  isPending: boolean;
  error: unknown;
}

export function UserFormDialog({
  open,
  onClose,
  user,
  onSubmit,
  isPending,
  error,
}: UserFormDialogProps) {
  const editing = user !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: USER_ROLES.STAFF },
  });

  // O diálogo não desmonta entre uma abertura e outra, então o formulário
  // guardaria o que foi digitado da última vez — inclusive o nome de outra
  // pessoa, na edição seguinte. Recarregar na abertura resolve.
  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      user === undefined
        ? { name: '', email: '', role: USER_ROLES.STAFF }
        : { name: user.name, email: user.email, role: user.role },
    );
  }, [open, user, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar cadastro' : 'Novo acesso ao painel'}
      description={
        editing
          ? 'Mudar o papel vale na próxima ação da pessoa, sem precisar que ela saia e entre.'
          : 'O painel gera a senha do primeiro acesso e mostra uma vez, depois de salvar.'
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
        noValidate
      >
        <Input
          label="Nome"
          block
          autoComplete="off"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="E-mail"
          type="email"
          block
          autoComplete="off"
          hint="E com ele que a pessoa entra no painel."
          error={errors.email?.message}
          {...register('email')}
        />

        <Select
          label="Papel"
          block
          options={ROLE_OPTIONS}
          error={errors.role?.message}
          {...register('role')}
        />

        {error === null || error === undefined ? null : (
          <p className={styles.error} role="alert">
            {errorMessage(error)}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>

          <Button type="submit" loading={isPending}>
            {editing ? 'Salvar' : 'Criar acesso'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
