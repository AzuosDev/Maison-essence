import { z } from 'zod';
import { normalizePhone } from '@/lib/format';
import { PASSWORD_MIN_LENGTH } from './account.types';
import { resolveIdentifier } from './sign-in-identifier';

/**
 * As regras dos formularios da conta.
 *
 * Os limites sao os do backend, campo por campo, e a igualdade e o ponto:
 * uma senha de sete caracteres aceita aqui seria recusada la, depois de o
 * cadastro inteiro ter sido preenchido no teclado do celular.
 *
 * As mensagens dizem o que falta e como consertar — nunca "invalido". Quem
 * le "Informe um celular com DDD, como (88) 99999-9999" sabe o que fazer sem
 * adivinhar o formato.
 */

/**
 * O telefone, com a mesma funcao que a mascara do campo usa.
 *
 * `normalizePhone` e a **mesma** regra do checkout e a mesma do backend
 * (`orders/phone.ts`). Isso nao e capricho de arquitetura: e por este numero
 * que os pedidos feitos como convidado encontram a conta depois. Duas regras
 * de telefone produziriam `88999999999` na conta e `5588999999999` no
 * pedido, e um historico que nunca se junta.
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
 * A entrada, que e uma so para os dois publicos.
 *
 * Um campo de identificacao — celular do cliente ou e-mail de quem trabalha
 * na loja — e a senha. O formato do que foi digitado decide para qual login
 * a tentativa vai, e quem sabe ler esse formato e `resolveIdentifier`.
 *
 * A mensagem de recusa cita os dois exemplos de proposito: quem errou o
 * celular precisa do formato com DDD, e quem errou o e-mail precisa saber
 * que ele tambem serve aqui.
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

  // Sem minimo: aqui nao se cadastra senha, se confere uma. Exigir oito
  // caracteres no login so contaria a quem tenta adivinhar que as senhas
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
 * Sem telefone e sem senha, e a ausencia e do contrato: `PATCH /customer/me`
 * nao aceita nenhum dos dois. O telefone e a chave que liga a conta aos
 * pedidos, e trocar senha e outro fluxo, com a senha atual e queda de
 * sessao.
 */
export const profileSchema = z.object({ name, email });

export type ProfileForm = z.input<typeof profileSchema>;

/**
 * O endereco salvo.
 *
 * Rua e bairro sao obrigatorios; numero, complemento, CEP e referencia nao.
 * Endereco sem numero existe — "s/n" e resposta legitima — e exigi-lo so
 * produziria um campo preenchido com um tracinho.
 *
 * O apelido tambem e opcional: quem tem um endereco so nao precisa batizar
 * o lugar onde mora. A tela escreve "Meu endereco" quando ele vem vazio.
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
   * "Usar como padrao".
   *
   * Uma intencao, e nao o campo gravado. Quem decide e o servidor, a partir
   * da posicao na lista: o **primeiro marcado** vence e os outros perdem a
   * marca; se nenhum vier marcado, o primeiro da lista assume. A tela
   * respeita essa regra montando a lista na ordem certa, e nao mandando dois
   * enderecos marcados para o servidor desempatar.
   */
  isDefault: z.boolean(),
});

export type AddressForm = z.output<typeof addressSchema>;
