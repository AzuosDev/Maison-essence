import type { UserRole } from '../../common/enums/user-role.js';
import type { UserDocument } from './schemas/user.schema.js';

/** Usuário como o painel o vê. Monta campo a campo: `passwordHash` não tem
 * como escapar por descuido. */
export interface UserView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserView(user: UserDocument): UserView {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
