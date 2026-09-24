import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../enums/user-role.js';

export const ROLES_KEY = 'roles';

/**
 * Restringe a rota aos papéis listados.
 *
 * `SUPER_ADMIN` nunca precisa ser listado: o `RolesGuard` o libera sempre. Se
 * ele aparecesse em cada lista, a primeira lista onde alguém esquecesse de
 * inclui-lo trancaria o desenvolvedor para fora do próprio sistema.
 *
 * Sem o decorator, a rota exige apenas estar autenticado. Os conjuntos
 * prontos ficam em `src/common/roles.ts`:
 *
 * ```ts
 * @Roles(...MANAGES_STORE)
 * @Patch(':id/price')
 * updatePrice() {}
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
