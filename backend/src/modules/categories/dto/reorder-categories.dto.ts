import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';
import { MAX_CATEGORY_ORDER } from '../categories.constants.js';

/**
 * A nova ordem do menu, do topo para o fim.
 *
 * O painel manda a lista inteira depois de arrastar um item, e nao o item que
 * se moveu: a posicao de um depende da dos outros, e mandar o conjunto e o que
 * dispensa o servidor de recalcular vizinhos.
 */
export class ReorderCategoriesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'informe ao menos uma categoria para reordenar' })
  @ArrayMaxSize(MAX_CATEGORY_ORDER + 1)
  @IsMongoId({ each: true, message: 'a lista de ordem tem um id inválido' })
  ids: string[];
}
