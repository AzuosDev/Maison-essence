import type { UserRole } from '../../common/enums/user-role.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

/**
 * Discriminador gravado dentro do proprio token.
 *
 * Os dois tokens tem segredos diferentes, entao a troca ja seria barrada na
 * assinatura; a claim existe como segunda barreira e para o erro sair legivel
 * no log em vez de "invalid signature".
 */
export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

/**
 * Para quem o token foi emitido: o painel ou a loja.
 *
 * Vai na claim `aud` e e conferida na verificacao. Os segredos ja sao
 * diferentes, entao um token de cliente nunca passaria pela assinatura do
 * painel — a audiencia existe para que a separacao esteja escrita dentro do
 * proprio token, legivel por quem depura e obrigatoria para quem verifica. E
 * e ela que permite ao guard do painel reconhecer um token de cliente e
 * responder "esta area nao e sua" em vez de "credencial invalida".
 */
export const TOKEN_AUDIENCES = {
  ADMIN: 'maison-essence/admin',
  CUSTOMER: 'maison-essence/customer',
} as const;

export type TokenAudience = (typeof TOKEN_AUDIENCES)[keyof typeof TOKEN_AUDIENCES];

/**
 * Claims do access token do cliente.
 *
 * Nao ha `role`, e a ausencia e o ponto: nao existe papel administrativo que
 * caiba neste payload, entao nenhum valor vindo daqui pode virar permissao de
 * painel. O que identifica a conta e o `sub`; `credentialVersion` faz o mesmo
 * que no painel — trocar a senha ou desativar a conta invalida na hora os
 * tokens ja emitidos.
 */
export interface CustomerAccessTokenPayload {
  sub: string;
  credentialVersion: number;
  type: typeof TOKEN_TYPES.ACCESS;
  aud?: string;
  iat?: number;
  exp?: number;
}

/** Claims do access token. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  /**
   * Copia de `User.credentialVersion`. O guard compara com o valor do banco:
   * incrementar la invalida na hora todo access token ja emitido, sem esperar
   * os 15 minutos.
   */
  credentialVersion: number;
  /** Viaja no token para o front saber que precisa mandar trocar a senha. */
  mustChangePassword: boolean;
  type: typeof TOKEN_TYPES.ACCESS;
  iat?: number;
  exp?: number;
}

/**
 * Claims do refresh token. Carrega o minimo: o `jti` e o `_id` do documento em
 * `refresh_tokens`, e e por ele que a rotacao encontra a sessao.
 */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: typeof TOKEN_TYPES.REFRESH;
  iat?: number;
  exp?: number;
}

/** Usuario autenticado, como o guard o anexa ao request. */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  credentialVersion: number;
  lastLoginAt: Date | null;
}

/** Par de tokens emitido no login e em cada rotacao. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Validade do access token em segundos, para o front agendar a renovacao. */
  expiresIn: number;
}

/** Corpo devolvido por `POST /auth/login` e `POST /auth/refresh`. */
export interface AuthSession extends IssuedTokens {
  tokenType: 'Bearer';
  user: AuthenticatedUser;
}

/**
 * Projeta o documento do usuario no que a sessao expoe.
 *
 * Existe para que `passwordHash` nunca chegue perto da resposta por descuido:
 * o que o guard anexa ao request e o que `/auth/me` devolve sao este objeto,
 * montado campo a campo, e nao o documento do Mongoose.
 */
export function toAuthenticatedUser(user: UserDocument): AuthenticatedUser {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    credentialVersion: user.credentialVersion,
    lastLoginAt: user.lastLoginAt,
  };
}
