import type { RateLimitRule } from '../rate-limit/rate-limit.decorator.js';

/**
 * Senha do cliente: oito caracteres.
 *
 * Menos que os doze do painel, e de proposito. As duas contas protegem coisas
 * diferentes: a do painel muda preco, estoque e usuario; a da loja mostra os
 * proprios pedidos e guarda o proprio endereco. E quem digita esta senha esta
 * num teclado de celular, no meio de uma compra — cada caractere exigido a
 * mais e uma conta que nao se cria e um carrinho que nao se fecha.
 */
export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;

/** Quantos enderecos uma conta guarda. Tamanho de tela, nao de negocio. */
export const MAX_ADDRESSES = 10;

/**
 * Cadastro: cinco por hora por IP.
 *
 * O cadastro e aberto na internet e cria documento no banco — e o alvo obvio
 * de quem quiser encher a colecao. Cinco cobre a familia inteira se
 * cadastrando do mesmo wi-fi da loja.
 */
export const CUSTOMER_REGISTER_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-register',
  limit: 5,
  windowSeconds: 60 * 60,
};

/** Login: dez tentativas por quinze minutos por IP. */
export const CUSTOMER_LOGIN_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-login',
  limit: 10,
  windowSeconds: 15 * 60,
};

/** Renovacao: generosa, porque quem renova ja provou ter uma sessao. */
export const CUSTOMER_REFRESH_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-refresh',
  limit: 30,
  windowSeconds: 15 * 60,
};

/**
 * Telefone ja cadastrado.
 *
 * Diz o que aconteceu porque aqui nao ha o que esconder: o telefone e a chave
 * natural e quem esta na tela acabou de digitar o proprio numero. Mandar essa
 * pessoa para o login e o unico caminho util; um erro generico a deixaria
 * tentando de novo com o mesmo numero.
 */
export const PHONE_TAKEN_MESSAGE =
  'Ja existe uma conta com este telefone. Entre com a sua senha.';

export const EMAIL_TAKEN_MESSAGE = 'Ja existe uma conta com este e-mail.';

export const CUSTOMER_NOT_FOUND_MESSAGE = 'Conta nao encontrada.';

export const ORDER_NOT_FOUND_MESSAGE = 'Pedido nao encontrado.';

/** Endereco salvo apontando para cidade que a loja nao atende. */
export const UNKNOWN_CITY_MESSAGE =
  'A loja nao entrega nessa cidade. Escolha uma das cidades atendidas.';

/** Endereco com `id` que nao esta na conta. */
export function unknownAddressesMessage(ids: readonly string[]): string {
  return `Estes enderecos nao sao desta conta: ${ids.join(', ')}.`;
}

export const DEFAULT_ORDERS_PAGE_SIZE = 10;
export const MAX_ORDERS_PAGE_SIZE = 50;
