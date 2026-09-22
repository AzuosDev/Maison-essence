import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { ROUTES } from '@/app/routes';
import { Button, Input } from '@/components/ui';
import { useAdminLogin, useIsSignedIn, useMustChangePassword } from '@/features/admin';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-auth.module.css';

/**
 * A entrada do painel.
 *
 * Tela propria, fora da moldura do painel e fora da moldura da loja: quem
 * chega aqui nao tem sessao, e um menu lateral com oito areas que ela nao
 * pode abrir seria um menu de mentira. Fica o suficiente para entrar.
 *
 * ## O tom
 *
 * Sobrio, no preto e no creme da marca. E a mesma casa da loja, vista pelos
 * fundos: a dona reconhece onde esta, e quem tropecou no endereco entende
 * que nao e para ele.
 *
 * ## O erro
 *
 * Uma mensagem so, acima do formulario, e nunca "e-mail ou senha
 * incorretos" em cima de um dos campos: dizer qual dos dois errou conta a
 * quem tenta adivinhar se aquele e-mail existe no sistema. O backend ja
 * responde com a recusa generica; a tela mantem a mesma discricao.
 */

const schema = z.object({
  email: z
    .email('Informe um e-mail valido.')
    .max(120, 'E-mail longo demais.')
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, 'Informe a senha.'),
});

type LoginForm = z.input<typeof schema>;

/** O que o guarda do painel guardou antes de mandar para ca. */
interface LocationState {
  from?: string;
}

export default function AdminLoginPage() {
  const location = useLocation();
  const signedIn = useIsSignedIn();
  const mustChangePassword = useMustChangePassword();
  const { mutateAsync, isPending, error } = useAdminLogin();

  usePageMeta({ title: 'Entrar no painel — Maison Essence', description: 'Acesso restrito.' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // Ja logado: volta para onde tentou ir, ou para a abertura do painel. Sem
  // isto, quem abre `/admin/entrar` por habito ficaria preso numa tela de
  // login com a sessao valida no bolso.
  if (signedIn) {
    if (mustChangePassword) {
      return <Navigate to={ROUTES.admin.changePassword} replace />;
    }

    const { from } = (location.state ?? {}) as LocationState;

    return <Navigate to={from ?? ROUTES.admin.root} replace />;
  }

  const submit = handleSubmit(async (values) => {
    await mutateAsync(schema.parse(values)).catch(() => {
      // A mensagem sai de `error`, logo abaixo. O `catch` existe para que a
      // recusa nao suba como rejeicao nao tratada.
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

          <h1 className={styles.title}>Entrar</h1>
        </header>

        {error === null ? null : (
          <p className={styles.error} role="alert">
            {loginErrorMessage(error)}
          </p>
        )}

        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <Input
            label="E-mail"
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" block loading={isPending} loadingLabel="Entrando">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}

/**
 * A recusa, em portugues de gente.
 *
 * O 401 do login e sempre generico, de proposito. O 429 tem texto proprio
 * porque a acao de quem le muda: nao adianta conferir a senha, adianta
 * esperar.
 */
function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401) {
      return 'E-mail ou senha nao conferem.';
    }

    if (error.status === 429) {
      return 'Tentativas demais. Espere um minuto antes de tentar de novo.';
    }
  }

  return errorMessage(error);
}
