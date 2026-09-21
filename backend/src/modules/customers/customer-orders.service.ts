import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { Paginated } from '../../common/pagination.js';
import { paginate, skipFor } from '../../common/pagination.js';
import { Order } from '../../schemas.js';
import { toCustomerOrderView, toOrderSummaryView } from '../orders/order.view.js';
import type { CustomerOrderView, OrderSummaryView } from '../orders/order.view.js';
import { DEFAULT_ORDERS_PAGE_SIZE, ORDER_NOT_FOUND_MESSAGE } from './customers.constants.js';
import type { ListCustomerOrdersDto } from './dto/list-customer-orders.dto.js';

/**
 * O historico de quem comprou.
 *
 * Toda consulta e filtrada por `customerId` — nunca por telefone. A diferenca
 * importa: o vinculo e conferido na adocao dos pedidos, uma vez, com a conta
 * ja autenticada; se a leitura procurasse por telefone, qualquer conta criada
 * com o numero de outra pessoa leria os pedidos dela sem que nada tivesse
 * sido vinculado.
 *
 * As mesmas projecoes do painel, sem a anotacao interna: `CustomerOrderView` e
 * a visao que o pedido ja oferecia a quem o criou, e reaproveita-la garante
 * que os dois lugares nunca divirjam sobre o que o cliente pode ver.
 */
@Injectable()
export class CustomerOrdersService {
  constructor(@InjectModel(Order.name) private readonly orders: Model<Order>) {}

  async list(
    customerId: string,
    query: ListCustomerOrdersDto,
  ): Promise<Paginated<OrderSummaryView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_ORDERS_PAGE_SIZE;
    const filter = { customerId: new Types.ObjectId(customerId) };
    const [found, totalItems] = await Promise.all([
      this.orders
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skipFor(page, limit))
        .limit(limit)
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);

    return paginate(found.map(toOrderSummaryView), totalItems, page, limit);
  }

  /**
   * Um pedido pelo codigo, dentro da propria conta.
   *
   * O `customerId` no filtro e o que impede o codigo de outra pessoa de ser
   * lido por quem o adivinhar — e `ME-AAMMDD-XXXX` e curto o bastante para
   * alguem tentar. Pedido de outra conta responde 404, e nao 403: dizer
   * "existe, mas nao e seu" ja seria contar demais.
   */
  async findByCode(customerId: string, code: string): Promise<CustomerOrderView> {
    const found = await this.orders
      .findOne({
        code: code.trim().toUpperCase(),
        customerId: new Types.ObjectId(customerId),
      })
      .exec();

    if (!found) {
      throw new NotFoundException(ORDER_NOT_FOUND_MESSAGE);
    }

    return toCustomerOrderView(found);
  }
}
