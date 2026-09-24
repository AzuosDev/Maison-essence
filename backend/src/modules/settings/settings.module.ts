import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoreSettings, StoreSettingsSchema } from '../../schemas.js';
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
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: StoreSettings.name, schema: StoreSettingsSchema }]),
  ],
  controllers: [SettingsController, PublicSettingsController, PublicPagesController],
  providers: [SettingsService],
  exports: [SettingsService, MongooseModule],
})
export class SettingsModule {}
