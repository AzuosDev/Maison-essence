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
 * Criar e editar um usuario do painel.
 *
 * ## Um dialogo para os dois, e nao dois formularios
 *
 * Os campos sao os mesmos — nome, e-mail, papel — e o que muda e o titulo, o
 * botao e o que acontece depois. Duplicar isso significaria que uma regra
 * nova ("e-mail no maximo 160") entraria em um dos dois e seria esquecida no
 * outro.
 *
 * A senha nao e campo de nenhum dos dois. Na criacao ela e gerada pelo
 * painel e mostrada depois que o servidor aceita — ver
 * `temporary-password.ts`; na edicao ela tem rota propria, porque trocar
 * senha e uma acao e nao a edicao de um campo.
 *
 * ## Dialogo, e nao pagina
 *
 * Tres campos nao justificam sair da lista e perder o contexto. E o
 * contrario do formulario de produto, que tem variantes, imagens e
 * categorias e precisa da pagina inteira.
 */

const schema = z.object({
  name: z.string().trim().min(2, 'Escreva o nome completo.').max(120, 'Nome longo demais.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Esse e-mail nao parece valido.')
    .max(160, 'E-mail longo demais.'),
  role: z.enum([USER_ROLES.SUPER_ADMIN, USER_ROLES.OWNER, USER_ROLES.STAFF]),
});

export type UserFormValues = z.output<typeof schema>;

/**
 * Os papeis, do menor alcance para o maior.
 *
 * Nesta ordem de proposito: quem escolhe le de cima para baixo e encontra
 * primeiro o papel que serve para a maioria dos casos — alguem que vai
 * ajudar a responder no WhatsApp. Colocar "Administrador" no topo o
 * transformaria no caminho de menor esforco.
 */
const ROLE_OPTIONS = [
  { value: USER_ROLES.STAFF, label: `${ROLE_LABELS.STAFF} — pedidos, sem precos` },
  { value: USER_ROLES.OWNER, label: `${ROLE_LABELS.OWNER} — a loja inteira` },
  { value: USER_ROLES.SUPER_ADMIN, label: `${ROLE_LABELS.SUPER_ADMIN} — a loja e o sistema` },
];

export interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Ausente na criacao. Presente, o dialogo edita este registro. */
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

  // O dialogo nao desmonta entre uma abertura e outra, entao o formulario
  // guardaria o que foi digitado da ultima vez — inclusive o nome de outra
  // pessoa, na edicao seguinte. Recarregar na abertura resolve.
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
          ? 'Mudar o papel vale na proxima acao da pessoa, sem precisar que ela saia e entre.'
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
