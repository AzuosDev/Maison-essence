import type { RateLimitRule } from '../rate-limit/rate-limit.decorator.js';

/**
 * Senha do cliente: oito caracteres.
 *
 * Menos que os doze do painel, e de propósito. As duas contas protegem coisas
 * diferentes: a do painel muda preço, estoque e usuário; a da loja mostra os
 * próprios pedidos e guarda o próprio endereço. E quem digita esta senha esta
 * num teclado de celular, no meio de uma compra — cada caractere exigido a
 * mais e uma conta que não se cria e um carrinho que não se fecha.
 */
export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;

/** Quantos endereços uma conta guarda. Tamanho de tela, não de negócio. */
export const MAX_ADDRESSES = 10;

/**
 * Cadastro: cinco por hora por IP.
 *
 * O cadastro e aberto na internet e cria documento no banco — e o alvo obvio
 * de quem quiser encher a coleção. Cinco cobre a família inteira se
 * cadastrando do mesmo wi-fi da loja.
 */
export const CUSTOMER_REGISTER_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-register',
  limit: 5,
  windowSeconds: 60 * 60,
};

/**
 * Login: cinco tentativas por quinze minutos por IP.
 *
 * O mesmo número do login do painel, e de propósito: são duas portas para o
 * mesmo tipo de ataque, e um teto mais alto de um lado seria o lado por onde
 * se tenta.
 */
export const CUSTOMER_LOGIN_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-login',
  limit: 5,
  windowSeconds: 15 * 60,
};

/** Renovação: generosa, porque quem renova já provou ter uma sessão. */
export const CUSTOMER_REFRESH_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-refresh',
  limit: 30,
  windowSeconds: 15 * 60,
};

/**
 * Telefone já cadastrado.
 *
 * Diz o que aconteceu porque aqui não há o que esconder: o telefone e a chave
 * natural e quem esta na tela acabou de digitar o próprio número. Mandar essa
 * pessoa para o login e o único caminho útil; um erro genérico a deixaria
 * tentando de novo com o mesmo número.
 */
export const PHONE_TAKEN_MESSAGE =
  'Já existe uma conta com este telefone. Entre com a sua senha.';

export const EMAIL_TAKEN_MESSAGE = 'Já existe uma conta com este e-mail.';

export const CUSTOMER_NOT_FOUND_MESSAGE = 'Conta não encontrada.';

export const ORDER_NOT_FOUND_MESSAGE = 'Pedido não encontrado.';

/** Endereço salvo apontando para cidade que a loja não atende. */
export const UNKNOWN_CITY_MESSAGE =
  'A loja não entrega nessa cidade. Escolha uma das cidades atendidas.';

/** Endereço com `id` que não esta na conta. */
export function unknownAddressesMessage(ids: readonly string[]): string {
  return `Estes endereços não são desta conta: ${ids.join(', ')}.`;
}

export const DEFAULT_ORDERS_PAGE_SIZE = 10;
export const MAX_ORDERS_PAGE_SIZE = 50;
