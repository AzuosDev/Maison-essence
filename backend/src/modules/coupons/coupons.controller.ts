import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { USER_ROLES } from '../../common/enums/user-role.js';
import { MANAGES_STORE } from '../../common/roles.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AUDIT_ACTIONS, AUDIT_TARGETS } from '../audit/audit.constants.js';
import type { AuditAction } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditChanges } from '../audit/audit.types.js';
import type { CouponView } from './coupon.view.js';
import { CouponsService } from './coupons.service.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';

/**
 * Cupons pelo painel.
 *
 * `MANAGES_STORE` inclusive na leitura: cupom e desconto, desconto e preço, e
 * preço e do gerente. O STAFF não vê — ele atende pedidos, e o pedido que
 * chega até ele já traz o desconto aplicado em copia própria.
 *
 * O `DELETE` sobe para o `SUPER_ADMIN`, como em produto, categoria e cidade.
 * Desligar o cupom encerra a campanha e guarda o histórico de quantos usos ela
 * teve; excluir apaga o histórico e não desfaz.
 *
 * ## Por que a trilha de auditoria esta aqui, e não no serviço
 *
 * Porque e aqui que existe o ator. O serviço e chamado também pela cotação, que
 * e publica e não tem usuário nenhum — exigir um `AuthenticatedUser` lá dentro
 * obrigaria a inventar um para a visitante que digitou um código na sacola.
 */
@Roles(...MANAGES_STORE)
@Controller('admin/coupons')
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(): Promise<CouponView[]> {
    return this.coupons.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CouponView> {
    return this.coupons.findOne(id);
  }

  @Post()
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCouponDto,
  ): Promise<CouponView> {
    const created = await this.coupons.create(dto);

    await this.record(actor, AUDIT_ACTIONS.COUPON_CREATED, created, {
      code: { from: '', to: created.code },
      discount: { from: '', to: created.discountLabel },
      maxUses: { from: null, to: created.maxUses },
    });

    return created;
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ): Promise<CouponView> {
    const before = await this.coupons.findOne(id);
    const after = await this.coupons.update(id, dto);

    await this.record(actor, AUDIT_ACTIONS.COUPON_UPDATED, after, {
      ...(before.code === after.code ? {} : { code: { from: before.code, to: after.code } }),
      ...(before.discountLabel === after.discountLabel
        ? {}
        : { discount: { from: before.discountLabel, to: after.discountLabel } }),
      ...(before.maxUses === after.maxUses
        ? {}
        : { maxUses: { from: before.maxUses, to: after.maxUses } }),
      ...(before.isActive === after.isActive
        ? {}
        : { isActive: { from: before.isActive, to: after.isActive } }),
      ...(before.showOnHome === after.showOnHome
        ? {}
        : { showOnHome: { from: before.showOnHome, to: after.showOnHome } }),
    });

    return after;
  }

  @Roles(USER_ROLES.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    const before = await this.coupons.findOne(id);

    await this.coupons.remove(id);

    await this.record(actor, AUDIT_ACTIONS.COUPON_DELETED, before, {
      code: { from: before.code, to: '' },
      usedCount: { from: before.usedCount, to: null },
    });
  }

  /** A entrada da trilha, sempre depois da gravação. */
  private record(
    actor: AuthenticatedUser,
    action: AuditAction,
    coupon: CouponView,
    changes: AuditChanges,
  ): Promise<void> {
    return this.audit.record({
      action,
      actor: { id: actor.id, email: actor.email, role: actor.role },
      target: { kind: AUDIT_TARGETS.COUPON, id: coupon.id, label: coupon.code },
      changes,
    });
  }
}
