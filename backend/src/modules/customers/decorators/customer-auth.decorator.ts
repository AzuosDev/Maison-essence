import { UseGuards, applyDecorators } from '@nestjs/common';
import { AuthAudience } from '../../../common/decorators/auth-audience.decorator.js';
import { TOKEN_AUDIENCES } from '../../auth/auth.types.js';
import { CustomerAuthGuard } from '../guards/customer-auth.guard.js';

/**
 * A rota exige uma conta de cliente.
 *
 * Faz as duas coisas que precisam andar juntas: tira a rota do caminho do
 * guard do painel e coloca o guard da loja no lugar. Separadas, uma delas
 * seria esquecida algum dia — e esquecer a primeira deixa a rota inalcancável,
 * enquanto esquecer a segunda a deixa aberta.
 */
export const CustomerAuth = () =>
  applyDecorators(AuthAudience(TOKEN_AUDIENCES.CUSTOMER), UseGuards(CustomerAuthGuard));
