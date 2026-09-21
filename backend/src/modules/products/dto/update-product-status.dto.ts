import { IsBoolean } from 'class-validator';

/**
 * O toggle da listagem do painel.
 *
 * Rota propria em vez de um `PATCH` no produto inteiro porque e o que a tela
 * faz: um clique no interruptor da linha, sem abrir o cadastro e sem mandar
 * o array de variantes junto.
 */
export class UpdateProductStatusDto {
  @IsBoolean()
  isActive: boolean;
}
