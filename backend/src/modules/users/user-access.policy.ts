import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { QueryFilter } from 'mongoose';
import type { UserRole } from '../../common/enums/user-role.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { User } from './schemas/user.schema.js';

export const USER_NOT_FOUND_MESSAGE = 'Usuario nao encontrado.';
export const OUT_OF_REACH_MESSAGE = 'Voce so pode gerenciar usuarios STAFF.';
export const ROLE_NOT_ALLOWED_MESSAGE = 'Voce so pode atribuir o papel STAFF.';
export const OWN_ROLE_MESSAGE = 'Nao e possivel mudar o proprio papel.';

/** Alvo minimo para as decisoes de acesso: papel e identidade. */
export interface UserTarget {
  id: string;
  role: UserRole;
}

/**
 * Quem pode o que sobre um usuario administrativo.
 *
 * Funcoes puras, de proposito: a regra e a parte do modulo que mais precisa
 * de teste e a que menos precisa de banco.
 *
 * - `SUPER_ADMIN` alcanca qualquer um.
 * - `OWNER` alcanca apenas `STAFF`, e para ele um `SUPER_ADMIN` nem existe.
 * - `STAFF` nao chega aqui: o `@Roles` do controller ja o barrou.
 *
 * A diferenca entre 404 e 403 e intencional. Alvo invisivel responde "nao
 * encontrado", porque confirmar a existencia de um `SUPER_ADMIN` para quem
 * nao deveria enxerga-lo ja e informacao. Alvo visivel fora do alcance
 * responde 403, que e o que de fato aconteceu.
 */

/** Filtro de listagem: o OWNER nunca ve um SUPER_ADMIN. */
export function visibilityFilter(actor: AuthenticatedUser): QueryFilter<User> {
  return actor.role === USER_ROLES.SUPER_ADMIN
    ? {}
    : { role: { $ne: USER_ROLES.SUPER_ADMIN } };
}

export function isVisible(actor: AuthenticatedUser, target: UserTarget): boolean {
  return actor.role === USER_ROLES.SUPER_ADMIN || target.role !== USER_ROLES.SUPER_ADMIN;
}

export function canManage(actor: AuthenticatedUser, target: UserTarget): boolean {
  if (actor.role === USER_ROLES.SUPER_ADMIN) {
    return true;
  }

  return actor.role === USER_ROLES.OWNER && target.role === USER_ROLES.STAFF;
}

export function isSelf(actor: AuthenticatedUser, target: UserTarget): boolean {
  return actor.id === target.id;
}

export function assertVisible(actor: AuthenticatedUser, target: UserTarget): void {
  if (!isVisible(actor, target)) {
    throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
  }
}

/** Gerenciar: mudar papel, status ou senha de outra pessoa. */
export function assertCanManage(actor: AuthenticatedUser, target: UserTarget): void {
  assertVisible(actor, target);

  if (!canManage(actor, target)) {
    throw new ForbiddenException(OUT_OF_REACH_MESSAGE);
  }
}

/**
 * Editar nome e e-mail. Vale tambem sobre si mesmo: a dona da loja poder
 * corrigir o proprio nome nao depende de ninguem.
 */
export function assertCanEditProfile(actor: AuthenticatedUser, target: UserTarget): void {
  assertVisible(actor, target);

  if (!isSelf(actor, target) && !canManage(actor, target)) {
    throw new ForbiddenException(OUT_OF_REACH_MESSAGE);
  }
}

/** Qual papel cada um pode atribuir, na criacao ou na edicao. */
export function assertCanAssignRole(actor: AuthenticatedUser, role: UserRole): void {
  if (actor.role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.STAFF) {
    return;
  }

  throw new ForbiddenException(ROLE_NOT_ALLOWED_MESSAGE);
}

/**
 * Ninguem muda o proprio papel. Sem isso, o unico SUPER_ADMIN pode se
 * rebaixar por engano e nao sobra quem o promova de volta.
 */
export function assertNotOwnRole(actor: AuthenticatedUser, target: UserTarget): void {
  if (isSelf(actor, target)) {
    throw new ForbiddenException(OWN_ROLE_MESSAGE);
  }
}
