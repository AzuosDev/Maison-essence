import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { subscribeToNewsletter } from '@/features/settings/newsletter';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/http';
import styles from './newsletter-form.module.css';

/**
 * O cadastro na newsletter.
 *
 * **O backend ainda não tem rota para isto.** O formulário valida e envia,
 * mas `subscribeToNewsletter` recusa de propósito, com uma mensagem que
 * manda o cliente para o WhatsApp — o canal que a loja de fato tem. Ver a
 * explicação inteira em `features/settings/newsletter.ts`.
 *
 * O componente esta escrito como se o endpoint existisse: validação com Zod,
 * estado de envio no botão, erro no campo. Quando a rota aparecer, o único
 * arquivo a mudar e aquele.
 */

const schema = z.object({
  email: z
    .email('Informe um e-mail válido.')
    .max(120, 'E-mail longo demais.')
    .transform((value) => value.trim().toLowerCase()),
});

type NewsletterForm = z.input<typeof schema>;

/**
 * O tom, conforme o fundo em que o formulário cai: o rodapé preto, onde ele
 * nasceu, ou a faixa clara da home.
 */
interface NewsletterFormProps {
  tone?: 'dark' | 'light';
}

export function NewsletterForm({ tone = 'dark' }: NewsletterFormProps) {
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

      setStatus('Pronto! Você vai receber as novidades.');
      reset();
    } catch (error) {
      setStatus(errorMessage(error));
    }
  });

  return (
    <form
      className={cx(styles.form, tone === 'light' && styles.light)}
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <p className={styles.label}>Receba as novidades</p>
      <p className={styles.note}>Lançamentos e promoções, sem excesso.</p>

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

        <Button
          type="submit"
          loading={isSubmitting}
          loadingLabel="Enviando"
          className={styles.submit}
        >
          Cadastrar
        </Button>
      </div>

      {/* Um `<output>`, que já carrega `role="status"`: a resposta do envio
          e anunciada a quem não a vê aparecer embaixo do campo. */}
      {status ? <output className={styles.status}>{status}</output> : null}
    </form>
  );
}
