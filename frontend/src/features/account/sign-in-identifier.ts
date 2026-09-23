import { z } from 'zod';
import { maskPhone, normalizePhone } from '@/lib/format';

/**
 * Quem esta tentando entrar, lido do que foi digitado.
 *
 * ## Um campo so, e a razao nao e economia de espaco
 *
 * A loja tem dois publicos que entram pela mesma porta: o cliente, que se
 * identifica pelo celular dos pedidos, e quem trabalha na loja, que se
 * identifica pelo e-mail do acesso. Um seletor "sou cliente / sou da loja"
 * resolveria o formulario e criaria um problema pior: anunciaria a toda
 * visita que existe um painel atras desta tela. Um campo que aceita os dois
 * nao conta nada a ninguem — o que decide o destino e o formato do que foi
 * escrito, e isso acontece **neste navegador**, sem perguntar ao servidor.
 *
 * ## A arroba decide antes do telefone
 *
 * `88@9` nao e um numero com pontuacao estranha: e uma tentativa de e-mail
 * mal digitada, e tratar como telefone produziria "celular ou senha nao
 * conferem" para quem errou o dominio. Havendo arroba, so resta e-mail.
 *
 * O telefone passa por `normalizePhone`, a **mesma** funcao do checkout e a
 * mesma regra do backend. Duas regras de telefone produziriam um login que
 * aceita um numero que o cadastro recusa.
 */

export type SignInIdentity =
  | { kind: 'phone'; phone: string }
  | { kind: 'email'; email: string };

/** O limite e o do `LoginDto` do servidor: passar disso ja seria recusa la. */
const emailRule = z.email().max(160);

/**
 * O que foi digitado, resolvido em identidade — ou `null` quando nao e
 * nenhuma das duas coisas.
 */
export function resolveIdentifier(value: string): SignInIdentity | null {
  const typed = value.trim();

  if (typed.includes('@')) {
    const email = typed.toLowerCase();

    return emailRule.safeParse(email).success ? { kind: 'email', email } : null;
  }

  const phone = normalizePhone(typed);

  return phone === null ? null : { kind: 'phone', phone };
}

/**
 * A forma que a mascara de telefone sabe embrulhar.
 *
 * Sem o `+`, e com teto de onze digitos: quem cola `+55 (88) 99999-9999` de
 * um contato salvo passa direto, sem mascara, e `normalizePhone` tira o
 * codigo do pais no envio. Mascarar aquilo cortaria nos onze primeiros
 * digitos e produziria `(55) 88999-9999`, um numero que nao e de ninguem.
 */
const PHONE_SHAPE = /^[\d\s()-]*$/;
const MAX_PHONE_DIGITS = 11;

/** `(88) 99999-9999` desmontado de volta em `88999999999`. */
const MASKED = /^\((\d{2})\)\s(\d{0,5})(?:-(\d{0,4}))?/;

/**
 * A mascara enquanto se digita, que sai de cena na primeira letra.
 *
 * O caso que obriga a desmontar antes de decidir e o e-mail que comeca com
 * numeros. Quem digita `123456@...` ve a mascara agir nos seis primeiros
 * digitos — ate ali nada distingue aquilo de um telefone — e, na arroba,
 * teria `(12) 3456@...` no campo. Por isso o valor volta a forma crua a
 * cada tecla: a mascara so se aplica se, **depois de desmontado**, o que
 * sobrou ainda for so numero, e couber num celular.
 *
 * O desmonte e ancorado no formato exato da mascara, e nao numa limpeza de
 * pontuacao: `maria-silva@exemplo.com` nao comeca com `(dd) ` e sai daqui
 * intacto, hifen e tudo.
 */
export function maskIdentifier(value: string): string {
  const raw = value.replace(MASKED, '$1$2$3');
  const digits = raw.replace(/\D/g, '');

  return PHONE_SHAPE.test(raw) && digits.length <= MAX_PHONE_DIGITS ? maskPhone(raw) : raw;
}
