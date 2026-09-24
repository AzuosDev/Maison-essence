import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPassword';

/**
 * Libera a rota para o usuário que ainda esta com senha temporária.
 *
 * Vale só para o que ele precisa poder fazer nesse estado: descobrir quem e
 * (`/auth/me`), renovar a sessão, sair e, no módulo de usuários, trocar a
 * própria senha. Qualquer outra rota administrativa responde 403.
 */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
