import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { PasswordField } from '@/components/account';
import { Button } from '@/components/ui';
import { newPasswordSchema, useResetPassword, type NewPasswordForm } from '@/features/account';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-auth.module.css';

/** O formato do token que o servidor gera: 32 bytes em hexadecimal. */
const TOKEN_SHAPE = /^[0-9a-f]{64}$/;

/**
 * `/conta/senha/nova?token=...`: criar a senha depois do link do e-mail.
 *
 * ## O token vem da URL, e não de um campo
 *
 * Quem chega aqui clicou num link. Pedir que a pessoa copie um código de
 * dentro do e-mail seria transformar um clique em três passos, e o passo do
 * meio — colar sem perder um caractere, no celular — e onde ela desiste.
 *
 * O formato e conferido aqui antes de qualquer envio. Não e validação de
 * segurança, que e do servidor: e para que um link truncado pelo cliente de
 * e-mail diga "peça outro" em vez de gastar a viagem e voltar com um erro
 * genérico.
 *
 * ## Não entra na conta no fim
 *
 * Gravada a senha, a tela manda entrar — e isso e decisão do servidor, que
 * responde sem sessão. Quem chegou aqui apresentou um link de e-mail, não uma
 * senha; e no login seguinte, com a senha recém-criada, que a conta volta a
 * ser dela.
 *
 * ## Duas vezes a mesma senha
 *
 * A confirmação não existe no servidor. Existe aqui porque o erro que ela
 * evita e o pior possível neste ponto: uma senha digitada errada uma vez só
 * tranca a pessoa do lado de fora, e o caminho de volta e este mesmo e-mail,
 * de novo.
 */
export default function AccountNewPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();

  usePageMeta({
    title: 'Criar senha nova — Maison Essence',
    description: 'Defina a senha da sua conta.',
    robots: 'noindex',
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  const submit = handleSubmit(async (values) => {
    await reset.mutateAsync({ token, password: values.password }).catch(() => {
      // A mensagem sai de `reset.error`, abaixo.
    });
  });

  if (!TOKEN_SHAPE.test(token)) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1 className={styles.title}>Este link não esta completo</h1>

          <p className={styles.lead}>
            Alguns aplicativos de e-mail cortam links longos. Peça outro e abra tocando direto na
            mensagem.
          </p>

          <Link to={ROUTES.account.forgotPassword} className={styles.link}>
            Pedir outro link
          </Link>
        </div>
      </div>
    );
  }

  if (reset.isSuccess) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1 className={styles.title}>Senha criada</h1>

          <output className={styles.lead}>
            Já pode entrar com ela. As sessões que estavam abertas em outros aparelhos foram
            encerradas.
          </output>

          <Link to={ROUTES.account.login} className={styles.link}>
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Criar senha nova</h1>

        <p className={styles.lead}>
          Escolha uma senha para a sua conta. Ela substitui a anterior em todos os aparelhos.
        </p>

        {reset.error === null || reset.error === undefined ? null : (
          <p className={styles.error} role="alert">
            {failureMessage(reset.error)}
          </p>
        )}

        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <PasswordField
            label="Senha nova"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <PasswordField
            label="Repita a senha"
            autoComplete="new-password"
            error={errors.confirmation?.message}
            {...register('confirmation')}
          />

          <Button type="submit" block loading={reset.isPending} loadingLabel="Salvando">
            Salvar a senha
          </Button>
        </form>

        <p className={styles.alternative}>
          <Link to={ROUTES.account.forgotPassword} className={styles.link}>
            Pedir outro link
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * A recusa, com a saída junto.
 *
 * O `400` aqui quase sempre significa link vencido, já usado ou substituído
 * por um mais novo — e o servidor já escreve isso por extenso, com o prazo.
 * O que a tela acrescenta e o caminho: o link de pedir outro fica logo
 * abaixo, sempre.
 */
function failureMessage(error: unknown): string {
  if (isApiError(error) && error.status === 429) {
    return 'Tentativas demais. Espere alguns minutos antes de tentar de novo.';
  }

  return errorMessage(error);
}
