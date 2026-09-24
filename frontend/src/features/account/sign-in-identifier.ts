import { z } from 'zod';
import { maskPhone, normalizePhone } from '@/lib/format';

/**
 * Quem esta tentando entrar, lido do que foi digitado.
 *
 * ## Um campo só, e a razão não e economia de espaço
 *
 * A loja tem dois públicos que entram pela mesma porta: o cliente, que se
 * identifica pelo celular dos pedidos, e quem trabalha na loja, que se
 * identifica pelo e-mail do acesso. Um seletor "sou cliente / sou da loja"
 * resolveria o formulário e criaria um problema pior: anunciaria a toda
 * visita que existe um painel atrás desta tela. Um campo que aceita os dois
 * não conta nada a ninguém — o que decide o destino e o formato do que foi
 * escrito, e isso acontece **neste navegador**, sem perguntar ao servidor.
 *
 * ## A arroba decide antes do telefone
 *
 * `88@9` não e um número com pontuação estranha: e uma tentativa de e-mail
 * mal digitada, e tratar como telefone produziria "celular ou senha não
 * conferem" para quem errou o domínio. Havendo arroba, só resta e-mail.
 *
 * O telefone passa por `normalizePhone`, a **mesma** função do checkout e a
 * mesma regra do backend. Duas regras de telefone produziriam um login que
 * aceita um número que o cadastro recusa.
 */

export type SignInIdentity =
  | { kind: 'phone'; phone: string }
  | { kind: 'email'; email: string };

/** O limite e o do `LoginDto` do servidor: passar disso já seria recusa lá. */
const emailRule = z.email().max(160);

/**
 * O que foi digitado, resolvido em identidade — ou `null` quando não e
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
 * A forma que a máscara de telefone sabe embrulhar.
 *
 * Sem o `+`, e com teto de onze digitos: quem cola `+55 (88) 99999-9999` de
 * um contato salvo passa direto, sem máscara, e `normalizePhone` tira o
 * código do pais no envio. Mascarar aquilo cortaria nos onze primeiros
 * digitos e produziria `(55) 88999-9999`, um número que não e de ninguém.
 */
const PHONE_SHAPE = /^[\d\s()-]*$/;
const MAX_PHONE_DIGITS = 11;

/** `(88) 99999-9999` desmontado de volta em `88999999999`. */
const MASKED = /^\((\d{2})\)\s(\d{0,5})(?:-(\d{0,4}))?/;

/**
 * A máscara enquanto se digita, que sai de cena na primeira letra.
 *
 * O caso que obriga a desmontar antes de decidir e o e-mail que começa com
 * números. Quem digita `123456@...` vê a máscara agir nos seis primeiros
 * digitos — até ali nada distingue aquilo de um telefone — e, na arroba,
 * teria `(12) 3456@...` no campo. Por isso o valor volta a forma crua a
 * cada tecla: a máscara só se aplica se, **depois de desmontado**, o que
 * sobrou ainda for só número, e couber num celular.
 *
 * O desmonte e ancorado no formato exato da máscara, e não numa limpeza de
 * pontuação: `maria-silva@exemplo.com` não começa com `(dd) ` e sai daqui
 * intacto, hífen e tudo.
 */
export function maskIdentifier(value: string): string {
  const raw = value.replace(MASKED, '$1$2$3');
  const digits = raw.replace(/\D/g, '');

  return PHONE_SHAPE.test(raw) && digits.length <= MAX_PHONE_DIGITS ? maskPhone(raw) : raw;
}
