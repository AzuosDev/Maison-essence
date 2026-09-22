import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { ROUTES } from '@/app/routes';
import { Button, Input } from '@/components/ui';
import {
  useAdminSignOut,
  useChangePassword,
  useIsSignedIn,
  useMustChangePassword,
} from '@/features/admin';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-auth.module.css';

/**
 * A troca da senha temporaria.
 *
 * Quem cria um acesso no painel define uma senha provisoria e a passa por
 * WhatsApp ou de viva voz. Ela serve para uma coisa so: chegar ate aqui. O
 * backend marca a conta com `mustChangePassword` e recusa **toda** rota
 * administrativa enquanto a marca existir — entao esta tela nao e uma
 * sugestao de boas praticas, e sim o unico caminho para dentro.
 *
 * A resposta da troca ja vem com a sessao nova, sem a marca: gravar essa
 * sessao e o que abre o painel, sem uma segunda consulta.
 *
 * ## O minimo de oito
 *
 * E a regra do backend (`ChangePasswordDto`). Conferir aqui tambem nao e
 * duplicacao inutil: e a diferenca entre o campo avisar enquanto se digita e
 * o servidor recusar depois de um envio.
 */

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha temporaria.'),
    newPassword: z
      .string()
      .min(8, 'A senha nova precisa de pelo menos 8 caracteres.')
      .max(72, 'Senha longa demais.'),
    confirmation: z.string().min(1, 'Repita a senha nova.'),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    message: 'As duas senhas precisam ser iguais.',
    path: ['confirmation'],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: 'A senha nova precisa ser diferente da temporaria.',
    path: ['newPassword'],
  });

type ChangePasswordForm = z.input<typeof schema>;

export default function AdminChangePasswordPage() {
  const signedIn = useIsSignedIn();
  const mustChangePassword = useMustChangePassword();
  const signOut = useAdminSignOut();
  const { mutateAsync, isPending, error } = useChangePassword();

  usePageMeta({ title: 'Trocar a senha — Maison Essence', description: 'Acesso restrito.' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });

  if (!signedIn) {
    return <Navigate to={ROUTES.admin.login} replace />;
  }

  // Trocada a senha, a tela some do caminho: ela existe para um estado, e o
  // estado acabou. Quem quiser trocar de novo usa a tela de conta.
  if (!mustChangePassword) {
    return <Navigate to={ROUTES.admin.root} replace />;
  }

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    await mutateAsync({ currentPassword, newPassword }).catch(() => {
      // A mensagem sai de `error`, logo abaixo.
    });
  });

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <p className={styles.brand}>
            Maison
            <span className={styles.brandNote}>Painel</span>
          </p>

          <h1 className={styles.title}>Crie a sua senha</h1>

          <p className={styles.lead}>
            A senha que voce recebeu e temporaria e serve so para esta tela. Escolha uma sua para
            continuar.
          </p>
        </header>

        {error === null ? null : (
          <p className={styles.error} role="alert">
            {changeErrorMessage(error)}
          </p>
        )}

        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <Input
            label="Senha temporaria"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />

          <Input
            label="Senha nova"
            type="password"
            autoComplete="new-password"
            hint="Pelo menos 8 caracteres."
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          <Input
            label="Repita a senha nova"
            type="password"
            autoComplete="new-password"
            error={errors.confirmation?.message}
            {...register('confirmation')}
          />

          <Button type="submit" block loading={isPending} loadingLabel="Salvando">
            Salvar e entrar
          </Button>
        </form>

        <button type="button" className={styles.link} onClick={signOut}>
          Sair
        </button>
      </div>
    </main>
  );
}

function changeErrorMessage(error: unknown): string {
  if (isApiError(error) && error.status === 401) {
    return 'A senha temporaria nao confere.';
  }

  return errorMessage(error);
}
