import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { subscribeToNewsletter } from '@/features/settings/newsletter';
import { errorMessage } from '@/lib/http';
import styles from './newsletter-form.module.css';

/**
 * O cadastro na newsletter.
 *
 * **O backend ainda nao tem rota para isto.** O formulario valida e envia,
 * mas `subscribeToNewsletter` recusa de proposito, com uma mensagem que
 * manda o cliente para o WhatsApp — o canal que a loja de fato tem. Ver a
 * explicacao inteira em `features/settings/newsletter.ts`.
 *
 * O componente esta escrito como se o endpoint existisse: validacao com Zod,
 * estado de envio no botao, erro no campo. Quando a rota aparecer, o unico
 * arquivo a mudar e aquele.
 */

const schema = z.object({
  email: z
    .email('Informe um e-mail valido.')
    .max(120, 'E-mail longo demais.')
    .transform((value) => value.trim().toLowerCase()),
});

type NewsletterForm = z.input<typeof schema>;

export function NewsletterForm() {
  const [status, setStatus] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async ({ email }) => {
    setStatus(null);

    try {
      await subscribeToNewsletter(email);

      setStatus('Pronto! Voce vai receber as novidades.');
      reset();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  });

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <p className={styles.label}>Receba as novidades</p>
      <p className={styles.note}>Lancamentos e promocoes, sem excesso.</p>

      <div className={styles.row}>
        <Input
          {...register('email')}
          type="email"
          label="E-mail"
          hideLabel
          placeholder="seu@email.com"
          autoComplete="email"
          error={errors.email?.message}
          className={styles.field}
        />

        <Button type="submit" loading={isSubmitting} loadingLabel="Enviando">
          Cadastrar
        </Button>
      </div>

      {/* Um `<output>`, que ja carrega `role="status"`: a resposta do envio
          e anunciada a quem nao a ve aparecer embaixo do campo. */}
      {status ? <output className={styles.status}>{status}</output> : null}
    </form>
  );
}
