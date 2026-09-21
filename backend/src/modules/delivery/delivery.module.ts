import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeliveryCity, DeliveryCitySchema } from '../../schemas.js';
import { SettingsModule } from '../settings/settings.module.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { PublicDeliveryController } from './public-delivery.controller.js';

/**
 * Entrega: as cidades atendidas, a taxa de cada uma e a retirada na loja.
 *
 * Importa `SettingsModule` porque metade da regra mora la — a flag de
 * retirada, o endereco da loja e o minimo global de frete gratis sao
 * configuracao da loja, nao da cidade. Sao coisas que a dona edita na mesma
 * tela e que valem para todas as cidades de uma vez.
 *
 * Exporta `DeliveryService` porque o modulo de pedidos vai chamar
 * `resolveFee` — e essa e a unica maneira prevista de um pedido chegar a uma
 * taxa de entrega.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: DeliveryCity.name, schema: DeliveryCitySchema }]),
    SettingsModule,
  ],
  controllers: [DeliveryController, PublicDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService, MongooseModule],
})
export class DeliveryModule {}
