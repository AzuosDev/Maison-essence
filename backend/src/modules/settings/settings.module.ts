import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema, StoreSettings, StoreSettingsSchema } from '../../schemas.js';
import { PublicPagesController } from './public-pages.controller.js';
import { PublicSettingsController } from './public-settings.controller.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

/**
 * Configurações da loja: o painel, a vitrine e as páginas institucionais.
 *
 * Exporta `SettingsService` porque outros módulos precisam ler a loja — o de
 * pedidos monta a mensagem do WhatsApp com o número e o nome que estão aqui,
 * e o de entrega lê a retirada na loja.
 *
 * `Product` entra por uma pergunta só: qual e a foto e o nome do produto que
 * a dona escolheu como brinde. E o model, e não o `ProductsModule` inteiro,
 * porque o módulo de produtos registra `StoreSettings` pelo mesmo tipo de
 * motivo — importar um ao outro fecharia um ciclo entre dois domínios que só
 * precisam ler um documento um do outro. `forFeature` repetido e idempotente.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoreSettings.name, schema: StoreSettingsSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [SettingsController, PublicSettingsController, PublicPagesController],
  providers: [SettingsService],
  exports: [SettingsService, MongooseModule],
})
export class SettingsModule {}
