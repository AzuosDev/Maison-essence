/**
 * Papeis do painel administrativo.
 *
 * Objeto const em vez de `enum` nativo: o `enum` do TypeScript gera um objeto
 * em runtime que nao existe no JavaScript emitido por transpiladores que so
 * apagam tipos, e o tipo derivado abaixo ja da a mesma seguranca com uniao de
 * literais, que o Mongoose aceita direto no `enum:` do schema.
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OWNER: 'OWNER',
  STAFF: 'STAFF',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES: readonly UserRole[] = Object.values(USER_ROLES);
