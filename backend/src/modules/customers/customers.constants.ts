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

/**
 * Pedir recuperação de senha: três por hora por IP.
 *
 * Mais apertado que o login, e por uma razão diferente: cada pedido aceito
 * **manda um e-mail**. Sem teto, a rota vira um jeito de usar a caixa de saída
 * da loja para encher a caixa de entrada de outra pessoa, e de queimar a cota
 * diária do Gmail numa tarde.
 */
export const CUSTOMER_FORGOT_PASSWORD_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-forgot-password',
  limit: 3,
  windowSeconds: 60 * 60,
};

/**
 * Usar o link: dez por quinze minutos por IP.
 *
 * Mais folgado que o login de propósito. Quem chega aqui já tem o token, e os
 * erros que ele comete são de senha curta e senha repetida — digitação, não
 * ataque. Adivinhar o token não e o que este teto impede; isso o sorteio de
 * trinta e dois bytes e o contador de tentativas do próprio pedido impedem.
 */
export const CUSTOMER_RESET_PASSWORD_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-reset-password',
  limit: 10,
  windowSeconds: 15 * 60,
};

/**
 * Trocar a senha estando dentro: cinco por quinze minutos por IP.
 *
 * A rota pede a senha atual, então e uma porta de adivinhação como o login —
 * e ganha o mesmo teto que ele, pelo mesmo motivo.
 */
export const CUSTOMER_CHANGE_PASSWORD_RATE_LIMIT: RateLimitRule = {
  scope: 'customer-change-password',
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

/**
 * Quanto tempo o link de recuperação vale: trinta minutos.
 *
 * Curto porque, enquanto vive, ele abre a conta sem senha. Longo o bastante
 * para o caminho real: a pessoa pede no celular, troca de aplicativo, acha o
 * e-mail, volta. Quinze minutos reprovaria quem foi atender um cliente no
 * meio; uma hora dobraria a janela sem servir a ninguém.
 */
export const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * Quantos tokens errados um pedido aguenta antes de se encerrar.
 *
 * O teto por IP não cobre quem tenta de endereços diferentes. Cinco e
 * generoso para um link que se clica, e irrisório para quem tenta adivinhar
 * trinta e dois bytes.
 */
export const MAX_RESET_ATTEMPTS = 5;

/** O formato do token que geramos: 64 caracteres hexadecimais (32 bytes). */
export const RESET_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/**
 * A resposta de "esqueci minha senha" — sempre esta, sempre 200.
 *
 * Nunca diz se a conta existe. "Não achei esse e-mail" transformaria a rota
 * num consultor de quem compra nesta loja, aberto na internet e sem login: dá
 * para perguntar por um telefone de cada vez até achar os que respondem
 * diferente.
 *
 * O "se existir" não e evasiva burocrática, e a informação exata que a pessoa
 * precisa: se ela digitou certo, chegou; se não chegou, ela digitou outra
 * coisa e deve tentar o outro dado.
 */
export const FORGOT_PASSWORD_MESSAGE =
  'Se existir uma conta com esse dado, o link para criar uma senha nova acabou de sair por e-mail. ' +
  'Ele vale por 30 minutos.';

/** Token inexistente, vencido, já usado ou tentado vezes demais. */
export const RESET_TOKEN_INVALID_MESSAGE =
  'Este link não vale mais: ele expira em 30 minutos e só funciona uma vez. Peça outro.';

/** Trocar senha com a atual errada. */
export const WRONG_CURRENT_PASSWORD_MESSAGE = 'Senha atual incorreta.';

/** Nova senha igual a que já estava gravada. */
export const SAME_PASSWORD_MESSAGE = 'A nova senha deve ser diferente da atual.';

/**
 * Trocar o e-mail sem confirmar a senha.
 *
 * O e-mail abre a conta — e por ele que se entra e e para ele que vai o link
 * de recuperação. Trocar o e-mail sem provar quem é seria, numa sessão
 * emprestada, a forma mais silenciosa de tomar uma conta: muda o endereço,
 * pede recuperação, e o dono perde o acesso sem nada ter parecido errado.
 */
export const EMAIL_CHANGE_NEEDS_PASSWORD_MESSAGE =
  'Para trocar o e-mail, confirme sua senha: e por ele que você entra na conta.';

export const DEFAULT_ORDERS_PAGE_SIZE = 10;
export const MAX_ORDERS_PAGE_SIZE = 50;
