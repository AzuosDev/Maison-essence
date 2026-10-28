import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AccountInvite, PasswordField } from '@/components/account';
import { Button, Input, useToast } from '@/components/ui';
import {
  changePasswordSchema,
  profileSchema,
  useChangePassword,
  useIsSignedIn,
  useProfile,
  useUpdateProfile,
  type ChangePasswordForm,
  type ProfileForm,
} from '@/features/account';
import { errorMessage } from '@/lib/http';
import { formatDate } from '@/lib/format';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-home-page.module.css';

/**
 * `/conta`: os dados de contato.
 *
 * ## Dois formulários, e um campo que não se edita
 *
 * Nome e e-mail em cima; a troca de senha embaixo, separada porque e outra
 * rota, outro risco e outro momento — quem veio corrigir o e-mail não esta
 * trocando a senha no mesmo gesto, e um botão só para as duas coisas faria
 * uma delas acontecer por engano.
 *
 * O telefone não se edita, e a ausência e do contrato: e por ele que os
 * pedidos — inclusive os feitos como convidado — se ligam a conta. Trocar
 * sozinho faria uma conta herdar o histórico de outra pessoa, ou perder o
 * próprio. Então trocar número e conversa com a loja, e a tela diz isso em
 * vez de deixar um campo cinza sem explicação.
 *
 * ## Trocar o e-mail pede a senha, e o nome não
 *
 * Desde que o e-mail também abre a conta, troca-lo e troca de credencial: numa
 * sessão emprestada, mudar o e-mail e pedir recuperação seria a forma mais
 * silenciosa de tomar uma conta. O servidor recusa sem a senha
 * (`EMAIL_CHANGE_NEEDS_PASSWORD_MESSAGE`), e a tela pede o campo no instante
 * em que vê o e-mail mudar — não antes, porque corrigir o próprio nome não
 * pode custar uma senha digitada.
 *
 * ## O formulário nasce preenchido, e espera o servidor
 *
 * `useProfile` devolve o que o login guardou enquanto a consulta viaja.
 * Quando ela chega, o efeito reescreve os campos — mas só os que não foram
 * tocados, via `reset` com os valores novos: quem já estava digitando um
 * e-mail novo não pode ver o campo voltar ao valor antigo no meio da frase.
 * E o que `isDirty` protege.
 */
export default function AccountProfilePage() {
  const signedIn = useIsSignedIn();
  const { data: profile } = useProfile();
  const { mutateAsync, isPending } = useUpdateProfile();
  const { toast } = useToast();

  usePageMeta({
    title: 'Meus dados — Maison Essence',
    description: 'Seus dados de contato na Maison Essence.',
    robots: 'noindex',
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile?.name ?? '', email: profile?.email ?? '', currentPassword: '' },
  });

  useEffect(() => {
    // Só enquanto ninguém mexeu: a resposta do servidor não pode apagar o
    // que esta sendo digitado agora.
    if (profile !== undefined && !isDirty) {
      reset({ name: profile.name, email: profile.email, currentPassword: '' });
    }
  }, [profile, isDirty, reset]);

  // O campo de senha aparece quando o e-mail digitado deixa de ser o que esta
  // gravado, e some quando a pessoa volta atrás.
  const typedEmail = useWatch({ control, name: 'email' });
  const emailChanged =
    profile !== undefined && typedEmail.trim().toLowerCase() !== profile.email.toLowerCase();

  if (!signedIn) {
    return (
      <AccountInvite
        title="Sua conta na Maison Essence"
        description="Entre para ver seus pedidos, guardar endereços e manter seus dados de contato em dia."
      />
    );
  }

  const submit = handleSubmit(async (values) => {
    const { currentPassword, ...contact } = profileSchema.parse(values);

    try {
      // A senha só viaja quando o e-mail muda: mandá-la sempre poria a senha
      // da pessoa no corpo de toda correção de nome.
      await mutateAsync(
        emailChanged ? { ...contact, currentPassword: currentPassword ?? '' } : contact,
      );
      reset({ ...contact, currentPassword: '' });
      toast({ title: 'Dados atualizados.', variant: 'success' });
    } catch (failure) {
      toast({
        title: 'Não deu para salvar',
        description: errorMessage(failure),
        variant: 'danger',
      });
    }
  });

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Meus dados</h1>

      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <Input
          label="Nome"
          autoComplete="name"
          autoCapitalize="words"
          error={errors.name?.message}
          {...register('name')}
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

        {emailChanged ? (
          <PasswordField
            label="Sua senha"
            autoComplete="current-password"
            hint="O e-mail também serve para entrar na conta, então trocá-lo pede a sua senha."
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
        ) : null}

        <div className={styles.locked}>
          <p className={styles.lockedLabel}>Celular</p>
          <p className={styles.lockedValue}>{profile?.phoneLabel ?? ''}</p>
          <p className={styles.lockedNote}>
            E por este número que seus pedidos encontram a conta, inclusive os que você fez sem
            entrar. Para troca-lo, fale com a loja pelo WhatsApp.
          </p>
        </div>

        <div className={styles.actions}>
          <Button type="submit" loading={isPending} loadingLabel="Salvando" disabled={!isDirty}>
            Salvar alterações
          </Button>
        </div>
      </form>

      <PasswordSection />

      {profile === undefined ? null : (
        <p className={styles.since}>Cliente desde {formatDate(profile.createdAt)}.</p>
      )}
    </section>
  );
}

/* ---- Trocar a senha ----------------------------------------------------------- */

/**
 * O segundo formulário da tela.
 *
 * ## A confirmação não e exigência do servidor
 *
 * E deste formulário, e existe por uma razão concreta: senha digitada errada
 * uma vez só vira uma pessoa trancada do lado de fora da própria conta, com
 * um e-mail de recuperação como único caminho de volta. Pedir duas vezes
 * custa um campo e evita o suporte inteiro.
 *
 * ## Trocar a senha não desloga quem trocou
 *
 * Derruba as **outras** sessões — e esse e o ponto, porque quem troca a senha
 * desconfiado precisa que o outro caia agora. A desta aba continua porque o
 * servidor devolve um par novo na resposta, e `useChangePassword` o grava.
 */
function PasswordSection() {
  const { mutateAsync, isPending } = useChangePassword();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      // Os três campos saem da tela assim que gravam: senha digitada não fica
      // esperando num formulário aberto.
      reset({ currentPassword: '', newPassword: '', confirmation: '' });

      toast({
        title: 'Senha trocada.',
        description: 'As outras sessões abertas foram encerradas.',
        variant: 'success',
      });
    } catch (failure) {
      toast({
        title: 'A senha não foi trocada',
        description: errorMessage(failure),
        variant: 'danger',
      });
    }
  });

  return (
    <section className={styles.aside} aria-labelledby="secao-senha">
      <h2 className={styles.asideTitle} id="secao-senha">
        Senha
      </h2>

      <p className={styles.asideText}>
        Trocar a senha encerra as outras sessões abertas — no computador da loja, no celular
        antigo. Esta aba continua aberta.
      </p>

      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <PasswordField
          label="Senha atual"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <PasswordField
          label="Senha nova"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />

        <PasswordField
          label="Repita a senha nova"
          autoComplete="new-password"
          error={errors.confirmation?.message}
          {...register('confirmation')}
        />

        <div className={styles.actions}>
          <Button type="submit" loading={isPending} loadingLabel="Trocando">
            Trocar a senha
          </Button>
        </div>
      </form>
    </section>
  );
}
