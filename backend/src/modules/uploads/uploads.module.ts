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
 * Registra os três models que guardam `publicId` — produtos, categorias e os
 * banners dentro das configurações — não para edita-los, mas para saber se
 * alguém ainda usa a foto antes de apaga-lá da conta.
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
