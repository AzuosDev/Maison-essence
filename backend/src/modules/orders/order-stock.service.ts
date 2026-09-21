import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Product } from '../../schemas.js';
import { QUOTE_MISMATCH_REASONS, STOCK_TAKEN_MESSAGE } from './orders.constants.js';

/** Quanto tirar, ou devolver, de uma variante. */
export interface StockLine {
  productId: string;
  variantId: string;
  quantity: number;
}

/** A linha na hora de baixar: a encomenda nao exige estoque para sair. */
export interface StockTake extends StockLine {
  allowBackorder: boolean;
}

/**
 * O estoque de um pedido: baixa na criacao, devolucao no cancelamento.
 *
 * Aqui mora a unica coisa que separa esta loja de vender duas vezes a mesma
 * unidade. A conferencia da cotacao — "tem 1 em estoque, o pedido e de 1" —
 * acontece segundos antes da gravacao, e nesses segundos cabe outro cliente
 * inteiro: dois navegadores no mesmo perfume, os dois lendo estoque 1, os dois
 * fechando. Ler e depois gravar perde essa corrida sempre.
 *
 * Por isso a baixa nao le nada: a condicao de estoque suficiente viaja dentro
 * da propria atualizacao, e quem perde a corrida recebe zero documentos
 * alterados e vira 409. E o banco que decide, uma vez so, sem espaco entre a
 * pergunta e a resposta.
 */
@Injectable()
export class OrderStockService {
  private readonly logger = new Logger(OrderStockService.name);

  constructor(@InjectModel(Product.name) private readonly products: Model<Product>) {}

  /**
   * Baixa o estoque item por item, desfazendo tudo se um deles falhar.
   *
   * Uma linha de cada vez, e nao em paralelo, porque o que importa quando algo
   * falha e saber exatamente o que ja saiu — a lista do que devolver precisa
   * estar certa, e e ela que impede um pedido recusado de levar estoque junto.
   *
   * Sem transacao de proposito: ela exigiria replica set em todos os ambientes
   * e resolveria um problema que a compensacao ja resolve, com a diferenca de
   * que a compensacao funciona igual no Atlas gratuito e no banco em memoria
   * dos testes. O intervalo em que o estoque fica baixado por um pedido que
   * nao vai existir e o de uma gravacao que falhou.
   */
  async take(takes: readonly StockTake[]): Promise<void> {
    const applied: StockLine[] = [];

    for (const take of takes) {
      if (await this.decrement(take)) {
        applied.push(take);

        continue;
      }

      await this.giveBack(applied);

      throw new ConflictException({
        message: STOCK_TAKEN_MESSAGE,
        details: {
          reason: QUOTE_MISMATCH_REASONS.STOCK,
          productId: take.productId,
          variantId: take.variantId,
        },
      });
    }
  }

  /**
   * Devolve o que foi baixado.
   *
   * Nunca lanca. Quem chama esta aqui por dois caminhos — desfazendo um pedido
   * que nao vai existir, ou cancelando um que existiu — e nos dois o erro que
   * importa ja aconteceu ou ja foi respondido. Uma excecao daqui trocaria uma
   * mensagem util por um 500 e ainda assim nao devolveria o estoque; o registro
   * no log e o que permite acertar a mao depois.
   */
  async giveBack(lines: readonly StockLine[]): Promise<void> {
    for (const line of lines) {
      try {
        await this.increment(line);
      } catch (error: unknown) {
        this.logger.error(
          `Falha ao devolver ${line.quantity} unidade(s) da variante ${line.variantId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Tira as unidades desta variante, exigindo que elas existam.
   *
   * `$elemMatch` com a condicao de estoque no mesmo filtro e o coracao disto:
   * o `variants.$.stock` do `$inc` aponta para a variante que casou com o
   * filtro, entao ou a condicao valia e a baixa aconteceu, ou nada aconteceu.
   *
   * Na venda sob encomenda a condicao sai: a dona vende o que ainda vai
   * buscar, e o estoque negativo que sobra e a informacao certa — e quanto ela
   * deve ao cliente, nao um defeito.
   */
  private async decrement(take: StockTake): Promise<boolean> {
    const result = await this.products
      .updateOne(
        {
          _id: new Types.ObjectId(take.productId),
          variants: {
            $elemMatch: {
              _id: new Types.ObjectId(take.variantId),
              ...(take.allowBackorder ? {} : { stock: { $gte: take.quantity } }),
            },
          },
        },
        { $inc: { 'variants.$.stock': -take.quantity } },
      )
      .exec();

    return result.modifiedCount === 1;
  }

  private async increment(line: StockLine): Promise<void> {
    await this.products
      .updateOne(
        {
          _id: new Types.ObjectId(line.productId),
          'variants._id': new Types.ObjectId(line.variantId),
        },
        { $inc: { 'variants.$.stock': line.quantity } },
      )
      .exec();
  }
}
