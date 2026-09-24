/**
 * A inscricao na newsletter.
 *
 * ## Atencao: nao ha endpoint para isto ainda
 *
 * O backend nao tem rota de newsletter — nao existe coleccao de inscritos,
 * nem envio de e-mail, nem integracao com servico de disparo. O formulario do
 * rodape existe porque o mockup o pede e porque validar e-mail no cliente ja
 * e trabalho feito, mas **o endereco digitado nao e gravado em lugar nenhum**.
 *
 * A funcao esta separada, e nao embutida no componente, para que ligar isto
 * seja uma edicao de uma linha quando a rota existir:
 *
 * ```ts
 * return api.post('/newsletter', { email }, { scope: null });
 * ```
 *
 * Enquanto nao existe, ela falha de proposito. Um formulario que responde
 * "pronto, voce esta inscrito" sem gravar nada e pior do que um que diz que
 * o canal ainda nao esta no ar: o cliente que se inscreveu e nunca recebe
 * nada nao volta para conferir se o formulario funcionava.
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
