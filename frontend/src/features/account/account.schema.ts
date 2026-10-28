import { z } from 'zod';
import { normalizePhone } from '@/lib/format';
import { PASSWORD_MIN_LENGTH } from './account.types';
import { resolveIdentifier } from './sign-in-identifier';

/**
 * As regras dos formulários da conta.
 *
 * Os limites são os do backend, campo por campo, e a igualdade e o ponto:
 * uma senha de sete caracteres aceita aqui seria recusada lá, depois de o
 * cadastro inteiro ter sido preenchido no teclado do celular.
 *
 * As mensagens dizem o que falta e como consertar — nunca "inválido". Quem
 * lê "Informe um celular com DDD, como (88) 99999-9999" sabe o que fazer sem
 * adivinhar o formato.
 */

/**
 * O telefone, com a mesma função que a máscara do campo usa.
 *
 * `normalizePhone` e a **mesma** regra do checkout e a mesma do backend
 * (`orders/phone.ts`). Isso não e capricho de arquitetura: e por este número
 * que os pedidos feitos como convidado encontram a conta depois. Duas regras
 * de telefone produziriam `88999999999` na conta e `5588999999999` no
 * pedido, e um histórico que nunca se junta.
 */
const phone = z
  .string()
  .refine(
    (value) => normalizePhone(value) !== null,
    'Informe um celular com DDD, como (88) 99999-9999.',
  )
  .transform((value) => normalizePhone(value) ?? '');

const name = z.string().trim().min(2, 'Informe seu nome.').max(120, 'Nome longo demais.');

const email = z
  .email('Informe um e-mail válido.')
  .max(160, 'E-mail longo demais.')
  .transform((value) => value.trim().toLowerCase());

/**
 * A entrada, que e uma só para os dois públicos.
 *
 * Um campo de identificação — celular do cliente ou e-mail de quem trabalha
 * na loja — e a senha. O formato do que foi digitado decide para qual login
 * a tentativa vai, e quem sabe ler esse formato e `resolveIdentifier`.
 *
 * A mensagem de recusa cita os dois exemplos de propósito: quem errou o
 * celular precisa do formato com DDD, e quem errou o e-mail precisa saber
 * que ele também serve aqui.
 */
export const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Informe seu celular ou e-mail.')
    .refine(
      (value) => resolveIdentifier(value) !== null,
      'Informe um celular com DDD, como (88) 99999-9999, ou um e-mail.',
    ),

  // Sem mínimo: aqui não se cadastra senha, se confere uma. Exigir oito
  // caracteres no login só contaria a quem tenta adivinhar que as senhas
  // desta loja tem pelo menos oito — e recusaria, antes do servidor, quem
  // tem uma senha antiga mais curta.
  password: z.string().min(1, 'Informe sua senha.'),
});

export type SignInForm = z.input<typeof signInSchema>;

export const registerSchema = z.object({
  name,
  phone,
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha precisa de ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(128, 'Senha longa demais.'),
});

export type RegisterForm = z.input<typeof registerSchema>;

/**
 * Os dados de contato.
 *
 * Sem telefone, e a ausência e do contrato: `PATCH /customer/me` não o
 * aceita, porque ele e a chave que liga a conta aos pedidos — inclusive aos
 * feitos como convidado.
 *
 * `currentPassword` não e um dado de contato: e a confirmação que o servidor
 * passou a exigir quando o **e-mail** muda, desde que ele também abre a
 * conta. Fica aqui porque o formulário e um só, e a tela a pede no momento em
 * que vê o e-mail mudar.
 */
export const profileSchema = z.object({
  name,
  email,
  currentPassword: z.string().max(128, 'Senha longa demais.').optional(),
});

export type ProfileForm = z.input<typeof profileSchema>;

/**
 * A senha nova, em qualquer um dos dois caminhos.
 *
 * O mínimo e o do servidor, campo por campo, e a igualdade e o ponto: uma
 * senha de sete caracteres aceita aqui seria recusada lá, depois de a pessoa
 * ter digitado duas vezes no teclado do celular.
 */
const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha precisa de ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(128, 'Senha longa demais.');

/**
 * Trocar a senha estando dentro.
 *
 * A confirmação não existe no servidor — e campo de tela, e e o que impede a
 * pessoa de gravar um erro de digitação e ficar trancada do lado de fora da
 * própria conta. Ela e conferida contra a senha nova, e não contra a atual.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe sua senha atual.'),
    newPassword,
    confirmation: z.string().min(1, 'Repita a senha nova.'),
  })
  .refine((form) => form.newPassword === form.confirmation, {
    path: ['confirmation'],
    message: 'As duas senhas precisam ser iguais.',
  })
  .refine((form) => form.newPassword !== form.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha precisa ser diferente da atual.',
  });

export type ChangePasswordForm = z.input<typeof changePasswordSchema>;

/** "Esqueci minha senha": o mesmo campo da entrada. */
export const forgotPasswordSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Informe seu celular ou e-mail.')
    .refine(
      (value) => resolveIdentifier(value) !== null,
      'Informe um celular com DDD, como (88) 99999-9999, ou um e-mail.',
    ),
});

export type ForgotPasswordForm = z.input<typeof forgotPasswordSchema>;

/**
 * A senha nova, criada pelo link do e-mail.
 *
 * Sem senha atual: quem chega aqui não a sabe — e por isso que esta aqui. O
 * que prova a identidade e o token da URL, e ele não e campo de formulário.
 */
export const newPasswordSchema = z
  .object({
    password: newPassword,
    confirmation: z.string().min(1, 'Repita a senha nova.'),
  })
  .refine((form) => form.password === form.confirmation, {
    path: ['confirmation'],
    message: 'As duas senhas precisam ser iguais.',
  });

export type NewPasswordForm = z.input<typeof newPasswordSchema>;

/**
 * O endereço salvo.
 *
 * Rua e bairro são obrigatórios; número, complemento, CEP e referência não.
 * Endereço sem número existe — "s/n" e resposta legitima — e exigi-lo só
 * produziria um campo preenchido com um tracinho.
 *
 * O apelido também e opcional: quem tem um endereço só não precisa batizar
 * o lugar onde mora. A tela escreve "Meu endereço" quando ele vem vazio.
 */
export const addressSchema = z.object({
  label: z.string().trim().max(40, 'Apelido longo demais.'),
  cityId: z.string(),
  street: z.string().trim().min(3, 'Informe a rua.').max(160, 'Rua longa demais.'),
  number: z.string().trim().max(20, 'Número longo demais.'),
  complement: z.string().trim().max(80, 'Complemento longo demais.'),
  district: z.string().trim().min(2, 'Informe o bairro.').max(80, 'Bairro longo demais.'),
  zipCode: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\d{5}-?\d{3}$/.test(value),
      'O CEP tem oito digitos, como 63010-000.',
    ),
  reference: z.string().trim().max(200, 'Ponto de referência longo demais.'),

  /**
   * "Usar como padrão".
   *
   * Uma intenção, e não o campo gravado. Quem decide e o servidor, a partir
   * da posição na lista: o **primeiro marcado** vence e os outros perdem a
   * marca; se nenhum vier marcado, o primeiro da lista assume. A tela
   * respeita essa regra montando a lista na ordem certa, e não mandando dois
   * endereços marcados para o servidor desempatar.
   */
  isDefault: z.boolean(),
});

export type AddressForm = z.output<typeof addressSchema>;
