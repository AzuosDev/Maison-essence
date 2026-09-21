import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Category,
  CategorySchema,
  Product,
  ProductSchema,
  StoreSettings,
  StoreSettingsSchema,
} from '../../schemas.js';
import { CloudinaryService } from './cloudinary.service.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

/**
 * Imagens do painel.
 *
 * Registra os tres models que guardam `publicId` — produtos, categorias e os
 * banners dentro das configuracoes — nao para edita-los, mas para saber se
 * alguem ainda usa a foto antes de apaga-la da conta.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: StoreSettings.name, schema: StoreSettingsSchema },
    ]),
  ],
  controllers: [UploadsController],
  providers: [CloudinaryService, UploadsService],
  exports: [CloudinaryService],
})
export class UploadsModule {}
