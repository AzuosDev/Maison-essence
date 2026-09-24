/**
 * A inscrição na newsletter.
 *
 * ## Atenção: não há endpoint para isto ainda
 *
 * O backend não tem rota de newsletter — não existe colecção de inscritos,
 * nem envio de e-mail, nem integração com serviço de disparo. O formulário do
 * rodapé existe porque o mockup o pede e porque validar e-mail no cliente já
 * e trabalho feito, mas **o endereço digitado não e gravado em lugar nenhum**.
 *
 * A função esta separada, e não embutida no componente, para que ligar isto
 * seja uma edição de uma linha quando a rota existir:
 *
 * ```ts
 * return api.post('/newsletter', { email }, { scope: null });
 * ```
 *
 * Enquanto não existe, ela falha de propósito. Um formulário que responde
 * "pronto, você esta inscrito" sem gravar nada e pior do que um que diz que
 * o canal ainda não esta no ar: o cliente que se inscreveu e nunca recebe
 * nada não volta para conferir se o formulário funcionava.
 */

export const NEWSLETTER_UNAVAILABLE_MESSAGE =
  'O cadastro por e-mail ainda não esta no ar. Fale com a gente pelo WhatsApp para receber as novidades.';

export class NewsletterUnavailableError extends Error {
  constructor() {
    super(NEWSLETTER_UNAVAILABLE_MESSAGE);
    this.name = 'NewsletterUnavailableError';
  }
}

export function subscribeToNewsletter(_email: string): Promise<void> {
  return Promise.reject(new NewsletterUnavailableError());
}
