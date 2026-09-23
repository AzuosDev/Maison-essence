import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { PasswordField, PhoneField } from '@/components/account';
import { Button } from '@/components/ui';
import { loginSchema, useCustomerLogin, useIsSignedIn, type LoginForm } from '@/features/account';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-auth.module.css';

/**
 * `/conta/entrar`.
 *
 * ## Dois campos, e os dois grandes
 *
 * Telefone e senha. Nao ha "lembrar de mim" — a sessao ja sobrevive ao
 * fechamento do navegador —, nao ha captcha e nao ha um terceiro campo. Esta
 * tela e aberta no celular, quase sempre com uma mao so, e cada campo a mais
 * e uma pessoa que desiste e compra como convidada. O que nao e ruim: a
 * compra continua funcionando. Mas o historico dela nunca se junta.
 *
 * ## Entrar pelo telefone, e nao pelo e-mail
 *
 * O telefone e a chave natural desta loja: e o que se informa no checkout, e
 * o que a dona usa para responder no WhatsApp e e o que liga o pedido de
 * convidado a conta. Entrar por e-mail obrigaria a lembrar qual dos dois foi
 * cadastrado.
 *
 * ## A recusa nao diz qual dos dois errou
 *
 * O backend responde o mesmo `401` para telefone sem conta, senha errada e
 * conta desativada — e demora o mesmo tanto nos tres. A tela mantem a
 * discricao: "telefone ou senha nao conferem". Dizer "este telefone nao tem
 * conta" contaria, a quem estiver testando numeros, quais clientes esta loja
 * tem.
 *
 * O `429` e a excecao, e por um motivo pratico: quem bateu no limite nao
 * resolve nada conferindo a senha. A frase precisa dizer para esperar.
 *
 * ## Depois de entrar, volta para onde se estava
 *
 * `state.from` vem do convite que trouxe a pessoa ate aqui. Quem clicou em
 * "entrar" a partir de `/conta/pedidos/ME-260922-4KP1` volta para aquele
 * pedido, e nao para uma tela inicial que nao responde a pergunta que o
 * trouxe.
 */

/** O que o convite guardou antes de mandar para ca. */
interface LocationState {
  from?: string;
}

export default function AccountLoginPage() {
  const location = useLocation();
  const signedIn = useIsSignedIn();
  const { mutateAsync, isPending, error } = useCustomerLogin();

  usePageMeta({
    title: 'Entrar na minha conta — Maison Essence',
    description: 'Acompanhe seus pedidos e guarde seus enderecos.',
    robots: 'noindex',
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  // `useWatch` e nao `watch`: o segundo devolve uma funcao nova a cada
  // render, e o compilador do React recusa memoizar o componente inteiro por
  // causa dela. O primeiro e uma assinatura, e custa so este valor.
  const typedPhone = useWatch({ control, name: 'phone' });

  const { from } = (location.state ?? {}) as LocationState;

  // Ja logado: nao ha o que fazer nesta tela. Vai para onde queria ir, ou
  // para os pedidos — que e o motivo pelo qual alguem abre a conta.
  if (signedIn) {
    return <Navigate to={from ?? ROUTES.account.orders} replace />;
  }

  // O numero ja digitado atravessa para o cadastro: quem descobriu aqui que
  // nao tem conta nao deveria redigitar o telefone na tela seguinte — e e
  // justamente ele que liga os pedidos antigos a conta nova.
  const registerPath =
    typedPhone === '' ? ROUTES.account.register : ROUTES.account.registerWith(typedPhone);

  const submit = handleSubmit(async (values) => {
    await mutateAsync(loginSchema.parse(values)).catch(() => {
      // A mensagem sai de `error`, logo abaixo. O `catch` existe para que a
      // recusa nao suba como rejeicao nao tratada.
    });
  });

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.lead}>Use o telefone que voce informa nos pedidos.</p>

        {error === null ? null : (
          <p className={styles.error} role="alert">
            {loginErrorMessage(error)}
          </p>
        )}

        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <PhoneField
                label="Celular"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                error={errors.phone?.message}
              />
            )}
          />

          <PasswordField
            label="Senha"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" block loading={isPending} loadingLabel="Entrando">
            Entrar
          </Button>
        </form>

        <p className={styles.alternative}>
          Ainda nao tem conta?{' '}
          <Link
            to={registerPath}
            state={from === undefined ? undefined : { from }}
            className={styles.link}
          >
            Criar a minha
          </Link>
        </p>
      </div>

      <p className={styles.escape}>
        Nao precisa entrar para comprar.{' '}
        <Link to={ROUTES.products} className={styles.link}>
          Voltar para a loja
        </Link>
      </p>
    </div>
  );
}

/**
 * A recusa, em portugues de gente.
 *
 * O 401 e sempre generico, de proposito. O 429 tem texto proprio porque a
 * acao de quem le muda: nao adianta conferir a senha, adianta esperar.
 */
function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401) {
      return 'Telefone ou senha nao conferem. Confira o numero com o DDD.';
    }

    if (error.status === 429) {
      return 'Tentativas demais. Espere alguns minutos antes de tentar de novo.';
    }
  }

  return errorMessage(error);
}
