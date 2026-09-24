import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { PasswordField, PhoneField } from '@/components/account';
import { Button, Input } from '@/components/ui';
import {
  PASSWORD_MIN_LENGTH,
  registerSchema,
  useCustomerRegister,
  useIsSignedIn,
  type RegisterForm,
} from '@/features/account';
import { maskPhone, normalizePhone } from '@/lib/format';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-auth.module.css';

/**
 * `/conta/criar`.
 *
 * ## Quatro campos, e nenhum a mais
 *
 * Nome, celular, e-mail e senha. Os quatro são exigidos pelo backend — não
 * há o que cortar sem que o cadastro seja recusado do outro lado — e não há
 * o que acrescentar: nem confirmação de senha, nem data de nascimento, nem
 * caixa de "aceito receber novidades".
 *
 * A confirmação de senha merece a explicação, porque e o campo que todo
 * cadastro tem. Ela existe para pegar erro de digitação numa senha que não
 * se vê — e o olho do `PasswordField` resolve isso melhor, mostrando o que
 * foi digitado. Um quinto campo no teclado do celular custa mais do que
 * rende.
 *
 * ## O telefone chega preenchido, e e o ponto
 *
 * A confirmação do pedido oferece a conta a quem comprou como convidado, e
 * manda o telefone do pedido em `?telefone=`. E por esse número que o
 * servidor liga as compras anteriores a conta nova — pedir o número de novo
 * aqui só criaria a chance de ele ser digitado diferente, e de o histórico
 * nunca aparecer.
 *
 * A promessa esta escrita em cima do formulário, porque e o único argumento
 * que devolve algo no mesmo minuto: "seus pedidos anteriores aparecem
 * sozinhos".
 *
 * ## Telefone repetido manda para o login, com o número junto
 *
 * O `409` daqui e o único erro desta área que **explica o que houve**: quem
 * esta na tela acabou de digitar o próprio número, não há o que esconder, e
 * a única saída útil e a tela de entrada. Ela recebe o número já preenchido.
 */

interface LocationState {
  from?: string;
}

export default function AccountRegisterPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const signedIn = useIsSignedIn();
  const { mutateAsync, isPending, error } = useCustomerRegister();

  usePageMeta({
    title: 'Criar minha conta — Maison Essence',
    description: 'Acompanhe seus pedidos e guarde seus endereços.',
    robots: 'noindex',
  });

  const raw = params.get('telefone') ?? '';

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      // `normalizePhone` antes da máscara, e não só a máscara.
      //
      // O número pode chegar com o `55` na frente — de um contato salvo, de
      // um link antigo. `maskPhone` sozinha cortaria nos onze primeiros
      // digitos e produziria `(55) 88999-99988`, um número que não e de
      // ninguém: o campo abriria preenchido com lixo e o cadastro seria
      // recusado sem que a pessoa entendesse o motivo.
      phone: maskPhone(normalizePhone(raw) ?? raw),
      email: '',
      password: '',
    },
  });

  const { from } = (location.state ?? {}) as LocationState;

  if (signedIn) {
    return <Navigate to={from ?? ROUTES.account.orders} replace />;
  }

  const submit = handleSubmit(async (values) => {
    await mutateAsync(registerSchema.parse(values)).catch(() => {
      // A mensagem sai de `error`, logo abaixo.
    });
  });

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Criar minha conta</h1>

        <p className={styles.lead}>
          Se você já comprou aqui com este mesmo telefone, aqueles pedidos aparecem sozinhos na sua
          lista.
        </p>

        {error === null ? null : (
          <div className={styles.error} role="alert">
            {registerErrorMessage(error)}

            {isApiError(error) && error.status === 409 ? (
              <>
                {' '}
                <Link to={ROUTES.account.login} className={styles.errorLink}>
                  Ir para a entrada
                </Link>
              </>
            ) : null}
          </div>
        )}

        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <Input
            label="Nome"
            autoComplete="name"
            autoCapitalize="words"
            error={errors.name?.message}
            {...register('name')}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneField
                label="Celular"
                hint="O mesmo que você informa nos pedidos."
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                error={errors.phone?.message}
              />
            )}
          />

          <Input
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordField
            label="Senha"
            hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" block loading={isPending} loadingLabel="Criando">
            Criar conta
          </Button>
        </form>

        <p className={styles.alternative}>
          Já tem conta?{' '}
          <Link
            to={ROUTES.account.login}
            state={from === undefined ? undefined : { from }}
            className={styles.link}
          >
            Entrar
          </Link>
        </p>
      </div>

      <p className={styles.escape}>
        Criar conta não e obrigatório.{' '}
        <Link to={ROUTES.products} className={styles.link}>
          Voltar para a loja
        </Link>
      </p>
    </div>
  );
}

/**
 * O que deu errado no cadastro.
 *
 * Ao contrário do login, aqui o `409` conta o que houve: quem esta na tela
 * acabou de digitar o próprio número, e manda-lo tentar de novo as cegas
 * seria a única coisa pior do que não dizer nada. A frase vem do servidor,
 * que já a escreve pronta; o link para a entrada e acrescentado pela tela.
 */
function registerErrorMessage(error: unknown): string {
  if (isApiError(error) && error.status === 429) {
    return 'Muitos cadastros deste aparelho. Espere alguns minutos antes de tentar de novo.';
  }

  return errorMessage(error);
}
