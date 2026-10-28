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
 * `/conta/entrar`: a única porta de entrada da aplicação.
 *
 * ## Um formulário para os dois públicos
 *
 * O cliente entra pelo celular dos pedidos; a dona e quem trabalha na loja
 * entram pelo e-mail do acesso. São dois logins diferentes no servidor —
 * sessões, tokens e limites de tentativa separados —, mas uma tela só, e o
 * que decide o destino e o formato do que foi digitado, aqui no navegador.
 *
 * Um seletor "sou cliente / sou da loja" resolveria o mesmo problema e
 * criaria outro maior: anunciaria a cada visita que existe um painel atrás
 * desta tela. Um campo que aceita os dois não conta nada a ninguém.
 *
 * ## Dois campos, e os dois grandes
 *
 * Identificação e senha. Não há "lembrar de mim" — a sessão já sobrevive ao
 * fechamento do navegador —, não há captcha e não há um terceiro campo. Esta
 * tela e aberta no celular, quase sempre com uma mão só, e cada campo a mais
 * e uma pessoa que desiste e compra como convidada. O que não e ruim: a
 * compra continua funcionando. Mas o histórico dela nunca se junta.
 *
 * ## Um e-mail pode ser dos dois
 *
 * O cliente entra por celular **ou** por e-mail, desde que a conta guarda os
 * dois. Então um e-mail digitado aqui tenta primeiro o login do cliente e,
 * só se ele recusar, o do painel. A ordem e pelo tamanho das populações, e o
 * efeito colateral — um e-mail errado gasta tentativa nos dois contadores —
 * esta anotado no `submit`.
 *
 * ## A recusa não diz qual dos dois errou
 *
 * Os dois logins respondem o mesmo `401` para conta inexistente, senha
 * errada e conta desativada — e demoram o mesmo tanto nos três. A tela
 * mantem a discrição: não há "este telefone não tem conta", que contaria a
 * quem estivesse testando números quais clientes esta loja tem.
 *
 * O texto muda conforme **o que foi digitado**, e não conforme a resposta:
 * quem tentou um e-mail não precisa do conselho sobre o DDD. Essa leitura e
 * local, e não revela nada que quem digitou já não soubesse.
 *
 * O `429` e a exceção, e por um motivo prático: quem bateu no limite não
 * resolve nada conferindo a senha. A frase precisa dizer para esperar.
 *
 * ## Depois de entrar, volta para onde se estava
 *
 * `state.from` vem do convite — ou do guarda do painel — que trouxe a pessoa
 * até aqui. Quem clicou em "entrar" a partir de `/conta/pedidos/ME-260922`
 * volta para aquele pedido; quem foi barrado em `/admin/pedidos` volta para
 * lá depois de entrar com o e-mail.
 *
 * `from` e **filtrado pelo público**, e não e zelo: sem isso, um cliente que
 * entrasse depois de esbarrar no painel seria mandado para `/admin`, o
 * guarda de lá o devolveria para esta tela, e a sessão dele — valida — o
 * mandaria de novo para `/admin`. Um lá e ca sem fim.
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

  // `useWatch` e não `watch`: o segundo devolve uma função nova a cada
  // render, e o compilador do React recusa memoizar o componente inteiro por
  // causa dela. O primeiro e uma assinatura, e custa só este valor.
  const typed = useWatch({ control, name: 'identifier' });
  const identity = resolveIdentifier(typed);

  const { from } = (location.state ?? {}) as LocationState;

  // Já logado como cliente: não há o que fazer nesta tela. Vai para onde
  // queria ir, ou para os pedidos — que e o motivo pelo qual alguém abre a
  // conta.
  if (signedIn) {
    return <Navigate to={customerDestination(from)} replace />;
  }

  // O número já digitado atravessa para o cadastro: quem descobriu aqui que
  // não tem conta não deveria redigitar o telefone na tela seguinte — e e
  // justamente ele que liga os pedidos antigos a conta nova. Um e-mail não
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

    // A recusa da tentativa anterior sai de cena antes desta começar. Sem
    // isso, quem errou o celular, corrigiu para o e-mail e errou de novo
    // leria a mensagem do primeiro erro — e os dois nem sempre são o mesmo
    // erro: um `429` no login do cliente continuaria na tela por cima de um
    // `401` do painel, mandando esperar quem só precisava conferir a senha.
    customerLogin.reset();
    staffLogin.reset();

    if (who.kind === 'phone') {
      // O destino sai do `<Navigate>` lá em cima, assim que a sessão existe.
      await customerLogin
        .mutateAsync({ identifier: who.phone, password: values.password })
        .catch(() => {
          // A mensagem sai de `failure`, logo abaixo. O `catch` existe para
          // que a recusa não suba como rejeição não tratada.
        });

      return;
    }

    /*
     * E-mail: tenta o cliente primeiro, e o painel só depois.
     *
     * O cliente também entra por e-mail desde que a conta guarda um — e a
     * tela mostra esse e-mail num campo editável, o que fazia dele uma
     * armadilha enquanto só o telefone servia.
     *
     * A ordem e pelo tamanho das populações: a loja tem clientes aos milhares
     * e duas ou três contas de painel. Quem trabalha na loja paga uma
     * tentativa a mais; o cliente, nenhuma.
     *
     * O custo de ter duas tentativas e real e vale registrar: um e-mail
     * recusado gasta uma tentativa no contador do cliente **e** uma no do
     * painel. Os dois tetos são de cinco por quinze minutos, então quem erra
     * a senha cinco vezes esbarra nos dois ao mesmo tempo — que e o
     * comportamento desejado de qualquer jeito.
     */
    const asCustomer = await customerLogin
      .mutateAsync({ identifier: who.email, password: values.password })
      .catch(() => null);

    if (asCustomer !== null) {
      // O destino sai do `<Navigate>` lá em cima, assim que a sessão existe.
      return;
    }

    customerLogin.reset();

    const session = await staffLogin
      .mutateAsync({ email: who.email, password: values.password })
      .catch(() => null);

    if (session === null) {
      return;
    }

    // Aqui o destino e imperativo, e não declarativo como o do cliente: a
    // sessão do painel não pode tirar ninguém desta tela sozinha. Quem já
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

        {/*
          O link fica depois do botão, e não ao lado do campo de senha.

          Ao lado do campo ele disputa com o que a pessoa veio fazer — e quem
          lembra a senha não precisa ler aquilo. Depois do botão, ele e o
          segundo caminho para quem o primeiro não serviu, que e exatamente o
          que ele e.
        */}
        <p className={styles.alternative}>
          <Link to={ROUTES.account.forgotPassword} className={styles.link}>
            Esqueci minha senha
          </Link>
        </p>

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

/** O endereço pertence ao painel — as duas raizes, a atual e a antiga. */
function isAdminPath(path: string): boolean {
  return path.startsWith(ROUTE_GROUPS.admin) || path.startsWith(ROUTE_GROUPS.adminLegacy);
}

/**
 * Para onde o cliente vai depois de entrar.
 *
 * Nunca para o painel, mesmo que tenha sido o painel a mandar a pessoa para
 * ca: a sessão de cliente não abre nenhuma tela de lá, e o guarda a
 * devolveria para esta, que a mandaria de volta — sem fim.
 */
function customerDestination(from: string | undefined): string {
  return from === undefined || isAdminPath(from) ? ROUTES.account.orders : from;
}

/**
 * Para onde quem trabalha na loja vai depois de entrar.
 *
 * A senha temporária vence tudo: com ela, o backend recusa toda rota
 * administrativa menos a da troca, e mandar a pessoa para o painel só
 * mostraria erro em cada tela.
 *
 * Fora isso, volta para a tela do painel que a barrou. Um `from` da loja —
 * de quem clicou "entrar" na sacola e digitou o e-mail de acesso — não serve
 * de destino para uma sessão de painel: quem entrou por aqui queria o
 * painel.
 */
function staffDestination(from: string | undefined, mustChangePassword: boolean): string {
  if (mustChangePassword) {
    return ROUTES.admin.changePassword;
  }

  return from !== undefined && isAdminPath(from) ? from : ROUTES.admin.root;
}

/**
 * A recusa, em português de gente.
 *
 * O 401 e sempre genérico quanto ao **motivo** — não diz se foi a conta ou a
 * senha. O que ele adapta e o conselho, a partir do que a pessoa digitou: o
 * DDD só importa para quem escreveu um número.
 *
 * O 429 tem texto próprio porque a ação de quem lê muda: não adianta
 * conferir a senha, adianta esperar.
 */
function signInErrorMessage(error: unknown, identity: SignInIdentity | null): string {
  if (isApiError(error)) {
    if (error.status === 401) {
      return identity?.kind === 'email'
        ? 'E-mail ou senha não conferem.'
        : 'Celular ou senha não conferem. Confira o número com o DDD.';
    }

    if (error.status === 400) {
      return 'Confira o que foi digitado: use o celular com DDD ou o e-mail da conta.';
    }

    if (error.status === 429) {
      return 'Tentativas demais. Espere alguns minutos antes de tentar de novo.';
    }
  }

  return errorMessage(error);
}
