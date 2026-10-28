import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  Customer,
  CustomerSchema,
  DeliveryCity,
  DeliveryCitySchema,
  Order,
  OrderSchema,
  PasswordResetToken,
  PasswordResetTokenSchema,
} from '../../schemas.js';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomerOrdersController } from './customer-orders.controller.js';
import { CustomerOrdersService } from './customer-orders.service.js';
import { CustomerSessionService } from './customer-session.service.js';
import { CustomersController } from './customers.controller.js';
import { PasswordResetService } from './password-reset.service.js';
import { CustomerAuthGuard } from './guards/customer-auth.guard.js';
import { OptionalCustomerGuard } from './guards/optional-customer.guard.js';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy.js';

/**
 * Contas de cliente da loja.
 *
 * Importa `AuthModule` para reaproveitar o que já existe e não pode ter duas
 * versões: o hash de senha, a assinatura de token e a rotação de refresh com
 * detecção de reuso. O que e próprio da loja — segredo, audiência, tempo de
 * vida, coleção — viaja nas chamadas, não em uma copia do código.
 *
 * Registra `Order` para duas coisas: adotar os pedidos que o telefone já tinha
 * feito como convidado e responder o histórico da conta. Não importa
 * `OrdersModule` de propósito — quem depende de quem e o contrário, porque o
 * checkout precisa reconhecer o cliente logado, e duas importações cruzadas
 * seriam um ciclo.
 *
 * `OptionalCustomerGuard` e exportado justamente para isso: e o que o módulo
 * de pedidos usa para ligar o pedido a conta sem nunca exigir login.
 *
 * `MailModule` e `SettingsModule` entram pela recuperação de senha: o link
 * precisa sair por e-mail, e a mensagem assina com o nome que a loja tem hoje
 * — que e configuração, e não constante de build.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Order.name, schema: OrderSchema },
      { name: DeliveryCity.name, schema: DeliveryCitySchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
    ]),
    // Registrado com opções, e não importado cru: e o `register` que fornece o
    // `AuthModuleOptions` de que o guard da loja depende. Sem
    // `defaultStrategy` de propósito — aqui a estratégia e sempre pedida pelo
    // nome, e um padrão neste módulo só serviria para mascarar um esquecimento.
    PassportModule.register({ session: false }),
    AuthModule,
    MailModule,
    SettingsModule,
  ],
  controllers: [CustomersController, CustomerOrdersController],
  providers: [
    CustomerAuthService,
    PasswordResetService,
    CustomerOrdersService,
    CustomerSessionService,
    CustomerJwtStrategy,
    CustomerAuthGuard,
    OptionalCustomerGuard,
  ],
  exports: [CustomerSessionService, OptionalCustomerGuard, MongooseModule],
})
export class CustomersModule {}
