import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { CartQuoteService } from './cart-quote.service.js';
import { QUOTE_RATE_LIMIT } from './cart.constants.js';
import { QuoteCartDto } from './dto/quote-cart.dto.js';
import type { CartQuoteView } from './quote.view.js';

/**
 * Validação própria do corpo da cotação, sem `forbidNonWhitelisted`.
 *
 * O pipe global do projeto recusa campo desconhecido com 400, e e o
 * comportamento certo no painel: campo que o servidor não conhece e quase
 * sempre erro de quem chamou. Aqui e o oposto. O carrinho vive no
 * `localStorage` do visitante junto do nome, da foto e do preço de cada item,
 * e o checkout manda o objeto inteiro. Recusar isso transformaria "preço
 * enviado pelo cliente" em erro de integração; ignora-lo e a regra que esta
 * rota existe para cumprir — o que não esta no DTO e descartado aqui, em
 * silêncio, antes de qualquer conta.
 *
 * `expectedType` no lugar do tipo do parâmetro e o que faz o pipe global
 * passar direto: com o parâmetro declarado como `object`, ele não tem classe
 * para validar e não opina, e quem valida e este.
 */
const QUOTE_BODY = new ValidationPipe({
  expectedType: QuoteCartDto,
  whitelist: true,
  transform: true,
});

/**
 * A cotação do carrinho.
 *
 * Publica e sem sessão: quem esta montando a sacola ainda não se identificou,
 * e exigir cadastro para ver o total seria perder a venda antes dela começar.
 * O que protege a rota e o limite de trinta chamadas por minuto por IP —
 * suficiente para quem recalcula o carrinho a cada clique, curto para quem
 * quer varrer a tabela de preços da loja item a item.
 *
 * Não leva `@CdnCache`: o resultado depende do estoque do minuto e do
 * pagamento escolhido, e uma resposta dessas guardada na borda seria um preço
 * errado servido a outra pessoa. Sendo POST, nenhuma CDN a guardaria de
 * qualquer forma — o que falta e a tentação de adicionar o cabeçalho depois.
 */
@Public()
@RateLimit(QUOTE_RATE_LIMIT)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartQuoteService) {}

  /**
   * `200`, e não `201`: a cotação não cria nada. Nenhum documento sai desta
   * rota, nenhum estoque e reservado e nada do que foi simulado fica gravado.
   */
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@Body(QUOTE_BODY) body: object): Promise<CartQuoteView> {
    // O pipe acima devolve uma instância de `QuoteCartDto` já validada e sem
    // os campos que não pertencem a ela; o tipo do parâmetro e `object` só
    // para o pipe global não tentar valida-lo antes.
    return this.cart.quote(body as QuoteCartDto);
  }
}
