import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPassword';

/**
 * Libera a rota para o usuario que ainda esta com senha temporaria.
 *
 * Vale so para o que ele precisa poder fazer nesse estado: descobrir quem e
 * (`/auth/me`), renovar a sessao, sair e, no modulo de usuarios, trocar a
 * propria senha. Qualquer outra rota administrativa responde 403.
 */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
