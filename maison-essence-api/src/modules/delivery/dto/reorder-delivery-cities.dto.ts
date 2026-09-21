import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';
import { MAX_DELIVERY_CITY_ORDER } from '../delivery.constants.js';

/**
 * A nova ordem da lista de cidades, do topo para o fim.
 *
 * Mesma escolha do reorder de categorias: o painel manda a lista inteira
 * depois de arrastar um item, e a posicao gravada e o indice na lista. A
 * ordem importa na tela do checkout — a cidade da loja fica em primeiro
 * porque e a de quase todo pedido.
 */
export class ReorderDeliveryCitiesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'informe ao menos uma cidade para reordenar' })
  @ArrayMaxSize(MAX_DELIVERY_CITY_ORDER + 1)
  @IsMongoId({ each: true, message: 'a lista de ordem tem um id invalido' })
  ids: string[];
}
