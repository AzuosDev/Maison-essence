import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AccountInvite } from '@/components/account';
import { Button, Input, useToast } from '@/components/ui';
import {
  profileSchema,
  useIsSignedIn,
  useProfile,
  useUpdateProfile,
  type ProfileForm,
} from '@/features/account';
import { errorMessage } from '@/lib/http';
import { formatDate } from '@/lib/format';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-home-page.module.css';

/**
 * `/conta`: os dados de contato.
 *
 * ## Dois campos editaveis, e dois que nao sao
 *
 * Nome e e-mail se corrigem aqui. Telefone e senha, nao, e a ausencia dos
 * dois e do contrato — `PATCH /customer/me` nao aceita nenhum deles.
 *
 * Os motivos sao diferentes e os dois merecem estar escritos na tela, porque
 * a falta de um campo que se espera encontrar parece defeito:
 *
 * - **O telefone e a identidade da conta.** E por ele que os pedidos —
 *   inclusive os feitos como convidado — se ligam a ela. Trocar sozinho
 *   faria uma conta herdar o historico de outra pessoa, ou perder o proprio.
 *   Entao trocar numero e conversa com a loja.
 * - **A senha derruba sessao** e exige a senha atual, o que e outro fluxo e
 *   outra rota. A API ainda nao a publica, e a tela diz isso em vez de
 *   oferecer um campo que nao teria para onde enviar.
 *
 * ## O formulario nasce preenchido, e espera o servidor
 *
 * `useProfile` devolve o que o login guardou enquanto a consulta viaja.
 * Quando ela chega, o efeito reescreve os campos — mas so os que nao foram
 * tocados, via `reset` com os valores novos: quem ja estava digitando um
 * e-mail novo nao pode ver o campo voltar ao valor antigo no meio da frase.
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
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile?.name ?? '', email: profile?.email ?? '' },
  });

  useEffect(() => {
    // So enquanto ninguem mexeu: a resposta do servidor nao pode apagar o
    // que esta sendo digitado agora.
    if (profile !== undefined && !isDirty) {
      reset({ name: profile.name, email: profile.email });
    }
  }, [profile, isDirty, reset]);

  if (!signedIn) {
    return (
      <AccountInvite
        title="Sua conta na Maison Essence"
        description="Entre para ver seus pedidos, guardar endereços e manter seus dados de contato em dia."
      />
    );
  }

  const submit = handleSubmit(async (values) => {
    try {
      await mutateAsync(profileSchema.parse(values));
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

      <div className={styles.aside}>
        <h2 className={styles.asideTitle}>Senha</h2>
        <p className={styles.asideText}>
          A troca de senha ainda não esta disponível por aqui. Se precisar mudar a sua, fale com a
          loja pelo WhatsApp.
        </p>

        {profile === undefined ? null : (
          <p className={styles.since}>Cliente desde {formatDate(profile.createdAt)}.</p>
        )}
      </div>
    </section>
  );
}
