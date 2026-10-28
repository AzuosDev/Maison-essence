import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { IdentifierField } from '@/components/account';
import { Button } from '@/components/ui';
import {
  forgotPasswordSchema,
  useForgotPassword,
  type ForgotPasswordForm,
} from '@/features/account';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-auth.module.css';

/**
 * `/conta/senha/esqueci`: pedir o link de senha nova.
 *
 * ## O mesmo campo da entrada
 *
 * Celular ou e-mail, e por uma razão prática: o telefone e o que esta pessoa
 * sabe de cor, porque e o que ela digita em todo pedido. O e-mail da conta e
 * justamente o que ela pode não lembrar — e e para lá que a mensagem vai, de
 * um jeito ou de outro.
 *
 * ## A resposta não diz se a conta existe
 *
 * O servidor devolve a mesma frase para conta que existe e conta que não
 * existe, e a tela mostra essa frase. Não e evasiva: se a pessoa digitou
 * certo, chegou; se não chegou, ela digitou outra coisa e deve tentar o outro
 * dado. Dizer "não achei esse e-mail" transformaria esta tela — publica, sem
 * login — num consultor de quem compra nesta loja.
 *
 * ## O formulário sai de cena quando grava
 *
 * Depois do pedido, o campo some e fica a confirmação. Deixar o formulário
 * aberto convida a clicar de novo achando que não funcionou, e cada clique e
 * um e-mail — com três por hora, o terceiro clique trancaria a pessoa por uma
 * hora com três links na caixa de entrada, dos quais só o último vale.
 */
export default function AccountForgotPasswordPage() {
  const forgot = useForgotPassword();

  usePageMeta({
    title: 'Esqueci minha senha — Maison Essence',
    description: 'Receba um link para criar uma senha nova.',
    robots: 'noindex',
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: '' },
  });

  const submit = handleSubmit(async (values) => {
    await forgot.mutateAsync({ identifier: values.identifier.trim() }).catch(() => {
      // A mensagem sai de `forgot.error`, abaixo.
    });
  });

  if (forgot.isSuccess) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1 className={styles.title}>Confira seu e-mail</h1>

          {/*
            `<output>` e não `<p role="status">`: o elemento já carrega a
            região viva, e e o que anuncia a confirmação para quem não vê a
            tela mudar.
          */}
          <output className={styles.lead}>{forgot.data.message}</output>

          <p className={styles.alternative}>
            Não chegou? Procure no lixo eletrônico, ou{' '}
            <Link to={ROUTES.account.login} className={styles.link}>
              tente entrar de novo
            </Link>{' '}
            — talvez a senha seja outra.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Esqueci minha senha</h1>

        <p className={styles.lead}>
          Informe o celular dos seus pedidos ou o e-mail da conta. Mandamos um link para o e-mail
          cadastrado.
        </p>

        {forgot.error === null || forgot.error === undefined ? null : (
          <p className={styles.error} role="alert">
            {failureMessage(forgot.error)}
          </p>
        )}

        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <Controller
            control={control}
            name="identifier"
            render={({ field }) => (
              <IdentifierField
                label="Celular ou e-mail"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                error={errors.identifier?.message}
              />
            )}
          />

          <Button type="submit" block loading={forgot.isPending} loadingLabel="Enviando">
            Enviar o link
          </Button>
        </form>

        <p className={styles.alternative}>
          Lembrou?{' '}
          <Link to={ROUTES.account.login} className={styles.link}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * A recusa, em português de gente.
 *
 * O `429` e o único que precisa de texto próprio: quem bateu no limite não
 * resolve nada tentando de novo, e a frase precisa dizer para esperar — e
 * lembrar que os links já enviados continuam valendo, que e a saída real
 * dessa situação.
 */
function failureMessage(error: unknown): string {
  if (isApiError(error) && error.status === 429) {
    return 'Você já pediu alguns links. Espere um pouco antes de pedir outro — e confira se algum deles chegou.';
  }

  return errorMessage(error);
}
