import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ROUTE_GROUPS, ROUTES } from '@/app/routes';
import { IdentifierField, PasswordField } from '@/components/account';
import { Button } from '@/components/ui';
import {
  resolveIdentifier,
  signInSchema,
  useCustomerLogin,
  useIsSignedIn,
  type SignInForm,
  type SignInIdentity,
} from '@/features/account';
import { useAdminLogin } from '@/features/admin';
import { errorMessage, isApiError } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-auth.module.css';

/**
 * `/conta/entrar`: a unica porta de entrada da aplicacao.
 *
 * ## Um formulario para os dois publicos
 *
 * O cliente entra pelo celular dos pedidos; a dona e quem trabalha na loja
 * entram pelo e-mail do acesso. Sao dois logins diferentes no servidor —
 * sessoes, tokens e limites de tentativa separados —, mas uma tela so, e o
 * que decide o destino e o formato do que foi digitado, aqui no navegador.
 *
 * Um seletor "sou cliente / sou da loja" resolveria o mesmo problema e
 * criaria outro maior: anunciaria a cada visita que existe um painel atras
 * desta tela. Um campo que aceita os dois nao conta nada a ninguem.
 *
 * ## Dois campos, e os dois grandes
 *
 * Identificacao e senha. Nao ha "lembrar de mim" — a sessao ja sobrevive ao
 * fechamento do navegador —, nao ha captcha e nao ha um terceiro campo. Esta
 * tela e aberta no celular, quase sempre com uma mao so, e cada campo a mais
 * e uma pessoa que desiste e compra como convidada. O que nao e ruim: a
 * compra continua funcionando. Mas o historico dela nunca se junta.
 *
 * ## A recusa nao diz qual dos dois errou
 *
 * Os dois logins respondem o mesmo `401` para conta inexistente, senha
 * errada e conta desativada — e demoram o mesmo tanto nos tres. A tela
 * mantem a discricao: nao ha "este telefone nao tem conta", que contaria a
 * quem estivesse testando numeros quais clientes esta loja tem.
 *
 * O texto muda conforme **o que foi digitado**, e nao conforme a resposta:
 * quem tentou um e-mail nao precisa do conselho sobre o DDD. Essa leitura e
 * local, e nao revela nada que quem digitou ja nao soubesse.
 *
 * O `429` e a excecao, e por um motivo pratico: quem bateu no limite nao
 * resolve nada conferindo a senha. A frase precisa dizer para esperar.
 *
 * ## Depois de entrar, volta para onde se estava
 *
 * `state.from` vem do convite — ou do guarda do painel — que trouxe a pessoa
 * ate aqui. Quem clicou em "entrar" a partir de `/conta/pedidos/ME-260922`
 * volta para aquele pedido; quem foi barrado em `/admin/pedidos` volta para
 * la depois de entrar com o e-mail.
 *
 * `from` e **filtrado pelo publico**, e nao e zelo: sem isso, um cliente que
 * entrasse depois de esbarrar no painel seria mandado para `/admin`, o
 * guarda de la o devolveria para esta tela, e a sessao dele — valida — o
 * mandaria de novo para `/admin`. Um la e ca sem fim.
 */

/** O que o convite, ou o guarda do painel, guardou antes de mandar para ca. */
interface LocationState {
  from?: string;
}

export default function AccountLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = useIsSignedIn();

  const customerLogin = useCustomerLogin();
  const staffLogin = useAdminLogin();

  usePageMeta({
    title: 'Entrar — Maison Essence',
    description: 'Acompanhe seus pedidos e guarde seus endereços.',
    robots: 'noindex',
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: '', password: '' },
  });

  // `useWatch` e nao `watch`: o segundo devolve uma funcao nova a cada
  // render, e o compilador do React recusa memoizar o componente inteiro por
  // causa dela. O primeiro e uma assinatura, e custa so este valor.
  const typed = useWatch({ control, name: 'identifier' });
  const identity = resolveIdentifier(typed);

  const { from } = (location.state ?? {}) as LocationState;

  // Ja logado como cliente: nao ha o que fazer nesta tela. Vai para onde
  // queria ir, ou para os pedidos — que e o motivo pelo qual alguem abre a
  // conta.
  if (signedIn) {
    return <Navigate to={customerDestination(from)} replace />;
  }

  // O numero ja digitado atravessa para o cadastro: quem descobriu aqui que
  // nao tem conta nao deveria redigitar o telefone na tela seguinte — e e
  // justamente ele que liga os pedidos antigos a conta nova. Um e-mail nao
  // atravessa, porque o cadastro do cliente e pelo telefone.
  const registerPath =
    identity?.kind === 'phone'
      ? ROUTES.account.registerWith(identity.phone)
      : ROUTES.account.register;

  const submit = handleSubmit(async (values) => {
    const who = resolveIdentifier(values.identifier);

    if (who === null) {
      return;
    }

    // A recusa da tentativa anterior sai de cena antes desta comecar. Sem
    // isso, quem errou o celular, corrigiu para o e-mail e errou de novo
    // leria a mensagem do primeiro erro — e os dois nem sempre sao o mesmo
    // erro: um `429` no login do cliente continuaria na tela por cima de um
    // `401` do painel, mandando esperar quem so precisava conferir a senha.
    customerLogin.reset();
    staffLogin.reset();

    if (who.kind === 'phone') {
      // O destino sai do `<Navigate>` la em cima, assim que a sessao existe.
      await customerLogin.mutateAsync({ phone: who.phone, password: values.password }).catch(() => {
        // A mensagem sai de `failure`, logo abaixo. O `catch` existe para
        // que a recusa nao suba como rejeicao nao tratada.
      });

      return;
    }

    const session = await staffLogin
      .mutateAsync({ email: who.email, password: values.password })
      .catch(() => null);

    if (session === null) {
      return;
    }

    // Aqui o destino e imperativo, e nao declarativo como o do cliente: a
    // sessao do painel nao pode tirar ninguem desta tela sozinha. Quem ja
    // esta logado no painel e abre `/conta/entrar` veio entrar como
    // cliente — manda-lo para `/admin` fecharia a porta que ele acabou de
    // abrir.
    navigate(staffDestination(from, session.user.mustChangePassword), { replace: true });
  });

  const pending = customerLogin.isPending || staffLogin.isPending;
  const failure = customerLogin.error ?? staffLogin.error;

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.lead}>
          Use o celular que você informa nos pedidos, ou o e-mail do seu acesso.
        </p>

        {failure === null || failure === undefined ? null : (
          <p className={styles.error} role="alert">
            {signInErrorMessage(failure, identity)}
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

          <PasswordField
            label="Senha"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" block loading={pending} loadingLabel="Entrando">
            Entrar
          </Button>
        </form>

        <p className={styles.alternative}>
          Ainda não tem conta?{' '}
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
        Não precisa entrar para comprar.{' '}
        <Link to={ROUTES.products} className={styles.link}>
          Voltar para a loja
        </Link>
      </p>
    </div>
  );
}

/** O endereco pertence ao painel — as duas raizes, a atual e a antiga. */
function isAdminPath(path: string): boolean {
  return path.startsWith(ROUTE_GROUPS.admin) || path.startsWith(ROUTE_GROUPS.adminLegacy);
}

/**
 * Para onde o cliente vai depois de entrar.
 *
 * Nunca para o painel, mesmo que tenha sido o painel a mandar a pessoa para
 * ca: a sessao de cliente nao abre nenhuma tela de la, e o guarda a
 * devolveria para esta, que a mandaria de volta — sem fim.
 */
function customerDestination(from: string | undefined): string {
  return from === undefined || isAdminPath(from) ? ROUTES.account.orders : from;
}

/**
 * Para onde quem trabalha na loja vai depois de entrar.
 *
 * A senha temporaria vence tudo: com ela, o backend recusa toda rota
 * administrativa menos a da troca, e mandar a pessoa para o painel so
 * mostraria erro em cada tela.
 *
 * Fora isso, volta para a tela do painel que a barrou. Um `from` da loja —
 * de quem clicou "entrar" na sacola e digitou o e-mail de acesso — nao serve
 * de destino para uma sessao de painel: quem entrou por aqui queria o
 * painel.
 */
function staffDestination(from: string | undefined, mustChangePassword: boolean): string {
  if (mustChangePassword) {
    return ROUTES.admin.changePassword;
  }

  return from !== undefined && isAdminPath(from) ? from : ROUTES.admin.root;
}

/**
 * A recusa, em portugues de gente.
 *
 * O 401 e sempre generico quanto ao **motivo** — nao diz se foi a conta ou a
 * senha. O que ele adapta e o conselho, a partir do que a pessoa digitou: o
 * DDD so importa para quem escreveu um numero.
 *
 * O 429 tem texto proprio porque a acao de quem le muda: nao adianta
 * conferir a senha, adianta esperar.
 */
function signInErrorMessage(error: unknown, identity: SignInIdentity | null): string {
  if (isApiError(error)) {
    if (error.status === 401) {
      return identity?.kind === 'email'
        ? 'E-mail ou senha não conferem.'
        : 'Celular ou senha não conferem. Confira o número com o DDD.';
    }

    if (error.status === 429) {
      return 'Tentativas demais. Espere alguns minutos antes de tentar de novo.';
    }
  }

  return errorMessage(error);
}
