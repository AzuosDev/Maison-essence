import { SetMetadata } from '@nestjs/common';
import type { TokenAudience } from '../../modules/auth/auth.types.js';

export const AUTH_AUDIENCE_KEY = 'authAudience';

/**
 * Diz de quem e a credencial que abre esta rota.
 *
 * Sem o decorator, a rota e do painel: o guard global resolve um usuário
 * administrativo, que e o padrão seguro para uma API cujo grosso e o painel.
 * Marcada com a audiência da loja, a rota sai do caminho do guard global e
 * passa a ser autenticada pelo guard do cliente — não e rota aberta, e rota de
 * outra porta.
 *
 * Existe para que `@Public()` não precise ser usado onde ele mentiria: uma
 * rota que exige sessão de cliente não e publica, e marca-lá assim esconderia
 * de quem lê que ali há autenticação.
 */
export const AuthAudience = (audience: TokenAudience) =>
  SetMetadata(AUTH_AUDIENCE_KEY, audience);
