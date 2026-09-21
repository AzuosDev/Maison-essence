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
 * Validacao propria do corpo da cotacao, sem `forbidNonWhitelisted`.
 *
 * O pipe global do projeto recusa campo desconhecido com 400, e e o
 * comportamento certo no painel: campo que o servidor nao conhece e quase
 * sempre erro de quem chamou. Aqui e o oposto. O carrinho vive no
 * `localStorage` do visitante junto do nome, da foto e do preco de cada item,
 * e o checkout manda o objeto inteiro. Recusar isso transformaria "preco
 * enviado pelo cliente" em erro de integracao; ignora-lo e a regra que esta
 * rota existe para cumprir — o que nao esta no DTO e descartado aqui, em
 * silencio, antes de qualquer conta.
 *
 * `expectedType` no lugar do tipo do parametro e o que faz o pipe global
 * passar direto: com o parametro declarado como `object`, ele nao tem classe
 * para validar e nao opina, e quem valida e este.
 */
const QUOTE_BODY = new ValidationPipe({
  expectedType: QuoteCartDto,
  whitelist: true,
  transform: true,
});

/**
 * A cotacao do carrinho.
 *
 * Publica e sem sessao: quem esta montando a sacola ainda nao se identificou,
 * e exigir cadastro para ver o total seria perder a venda antes dela comecar.
 * O que protege a rota e o limite de trinta chamadas por minuto por IP —
 * suficiente para quem recalcula o carrinho a cada clique, curto para quem
 * quer varrer a tabela de precos da loja item a item.
 *
 * Nao leva `@CdnCache`: o resultado depende do estoque do minuto e do
 * pagamento escolhido, e uma resposta dessas guardada na borda seria um preco
 * errado servido a outra pessoa. Sendo POST, nenhuma CDN a guardaria de
 * qualquer forma — o que falta e a tentacao de adicionar o cabecalho depois.
 */
@Public()
@RateLimit(QUOTE_RATE_LIMIT)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartQuoteService) {}

  /**
   * `200`, e nao `201`: a cotacao nao cria nada. Nenhum documento sai desta
   * rota, nenhum estoque e reservado e nada do que foi simulado fica gravado.
   */
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@Body(QUOTE_BODY) body: object): Promise<CartQuoteView> {
    // O pipe acima devolve uma instancia de `QuoteCartDto` ja validada e sem
    // os campos que nao pertencem a ela; o tipo do parametro e `object` so
    // para o pipe global nao tentar valida-lo antes.
    return this.cart.quote(body as QuoteCartDto);
  }
}
