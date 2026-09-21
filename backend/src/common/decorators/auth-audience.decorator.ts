import { SetMetadata } from '@nestjs/common';
import type { TokenAudience } from '../../modules/auth/auth.types.js';

export const AUTH_AUDIENCE_KEY = 'authAudience';

/**
 * Diz de quem e a credencial que abre esta rota.
 *
 * Sem o decorator, a rota e do painel: o guard global resolve um usuario
 * administrativo, que e o padrao seguro para uma API cujo grosso e o painel.
 * Marcada com a audiencia da loja, a rota sai do caminho do guard global e
 * passa a ser autenticada pelo guard do cliente — nao e rota aberta, e rota de
 * outra porta.
 *
 * Existe para que `@Public()` nao precise ser usado onde ele mentiria: uma
 * rota que exige sessao de cliente nao e publica, e marca-la assim esconderia
 * de quem le que ali ha autenticacao.
 */
export const AuthAudience = (audience: TokenAudience) =>
  SetMetadata(AUTH_AUDIENCE_KEY, audience);
