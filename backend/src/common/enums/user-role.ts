/**
 * Papéis do painel administrativo.
 *
 * Objeto const em vez de `enum` nativo: o `enum` do TypeScript gera um objeto
 * em runtime que não existe no JavaScript emitido por transpiladores que só
 * apagam tipos, e o tipo derivado abaixo já da a mesma segurança com união de
 * literais, que o Mongoose aceita direto no `enum:` do schema.
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OWNER: 'OWNER',
  STAFF: 'STAFF',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES: readonly UserRole[] = Object.values(USER_ROLES);
