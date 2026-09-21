import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsAuditLog } from '../../common/settings-audit.log.js';
import { StoreSettings, StoreSettingsSchema } from '../../schemas.js';
import { PublicPagesController } from './public-pages.controller.js';
import { PublicSettingsController } from './public-settings.controller.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

/**
 * Configuracoes da loja: o painel, a vitrine e as paginas institucionais.
 *
 * Exporta `SettingsService` porque outros modulos precisam ler a loja — o de
 * pedidos monta a mensagem do WhatsApp com o numero e o nome que estao aqui,
 * e o de entrega le a retirada na loja.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: StoreSettings.name, schema: StoreSettingsSchema }]),
  ],
  controllers: [SettingsController, PublicSettingsController, PublicPagesController],
  providers: [SettingsService, SettingsAuditLog],
  exports: [SettingsService, MongooseModule],
})
export class SettingsModule {}
