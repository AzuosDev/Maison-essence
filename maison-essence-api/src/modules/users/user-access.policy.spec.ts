import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { USER_ROLES } from '../../common/enums/user-role.js';
import type { UserRole } from '../../common/enums/user-role.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  assertCanAssignRole,
  assertCanEditProfile,
  assertCanManage,
  assertNotOwnRole,
  canManage,
  isVisible,
  visibilityFilter,
} from './user-access.policy.js';

function actor(role: UserRole, id = 'ator'): AuthenticatedUser {
  return {
    id,
    name: 'Fulano',
    email: 'fulano@maisonessence.com',
    role,
    isActive: true,
    mustChangePassword: false,
    credentialVersion: 1,
    lastLoginAt: null,
  };
}

function target(role: UserRole, id = 'alvo'): { id: string; role: UserRole } {
  return { id, role };
}

describe('policy de acesso a usuarios', () => {
  describe('visibilidade', () => {
    it('o OWNER nao enxerga SUPER_ADMIN', () => {
      expect(isVisible(actor(USER_ROLES.OWNER), target(USER_ROLES.SUPER_ADMIN))).toBe(false);
      expect(isVisible(actor(USER_ROLES.OWNER), target(USER_ROLES.OWNER))).toBe(true);
      expect(isVisible(actor(USER_ROLES.OWNER), target(USER_ROLES.STAFF))).toBe(true);
    });

    it('o SUPER_ADMIN enxerga todo mundo', () => {
      expect(isVisible(actor(USER_ROLES.SUPER_ADMIN), target(USER_ROLES.SUPER_ADMIN))).toBe(
        true,
      );
    });

    it('o filtro de listagem esconde SUPER_ADMIN do OWNER', () => {
      expect(visibilityFilter(actor(USER_ROLES.OWNER))).toEqual({
        role: { $ne: USER_ROLES.SUPER_ADMIN },
      });
      expect(visibilityFilter(actor(USER_ROLES.SUPER_ADMIN))).toEqual({});
    });
  });

  describe('alcance', () => {
    it('o SUPER_ADMIN gerencia qualquer papel', () => {
      for (const role of Object.values(USER_ROLES)) {
        expect(canManage(actor(USER_ROLES.SUPER_ADMIN), target(role))).toBe(true);
      }
    });

    it('o OWNER so gerencia STAFF', () => {
      const owner = actor(USER_ROLES.OWNER);

      expect(canManage(owner, target(USER_ROLES.STAFF))).toBe(true);
      expect(canManage(owner, target(USER_ROLES.OWNER))).toBe(false);
      expect(canManage(owner, target(USER_ROLES.SUPER_ADMIN))).toBe(false);
    });

    it('alvo invisivel responde 404 e alvo fora do alcance responde 403', () => {
      const owner = actor(USER_ROLES.OWNER);

      expect(() => assertCanManage(owner, target(USER_ROLES.SUPER_ADMIN))).toThrow(
        NotFoundException,
      );
      expect(() => assertCanManage(owner, target(USER_ROLES.OWNER))).toThrow(
        ForbiddenException,
      );
    });

    it('editar o proprio cadastro nao depende de alcance', () => {
      const owner = actor(USER_ROLES.OWNER, 'mesmo-id');

      expect(() =>
        assertCanEditProfile(owner, target(USER_ROLES.OWNER, 'mesmo-id')),
      ).not.toThrow();
      expect(() => assertCanEditProfile(owner, target(USER_ROLES.OWNER, 'outro'))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('atribuicao de papel', () => {
    it('o OWNER so atribui STAFF', () => {
      const owner = actor(USER_ROLES.OWNER);

      expect(() => assertCanAssignRole(owner, USER_ROLES.STAFF)).not.toThrow();
      expect(() => assertCanAssignRole(owner, USER_ROLES.OWNER)).toThrow(ForbiddenException);
      expect(() => assertCanAssignRole(owner, USER_ROLES.SUPER_ADMIN)).toThrow(
        ForbiddenException,
      );
    });

    it('o SUPER_ADMIN atribui qualquer papel', () => {
      const superAdmin = actor(USER_ROLES.SUPER_ADMIN);

      for (const role of Object.values(USER_ROLES)) {
        expect(() => assertCanAssignRole(superAdmin, role)).not.toThrow();
      }
    });

    it('ninguem muda o proprio papel', () => {
      const superAdmin = actor(USER_ROLES.SUPER_ADMIN, 'mesmo-id');

      expect(() => assertNotOwnRole(superAdmin, target(USER_ROLES.SUPER_ADMIN, 'mesmo-id'))).toThrow(
        ForbiddenException,
      );
      expect(() =>
        assertNotOwnRole(superAdmin, target(USER_ROLES.SUPER_ADMIN, 'outro')),
      ).not.toThrow();
    });
  });
});
