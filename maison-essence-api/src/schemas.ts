/**
 * Ponto unico de importacao dos schemas do dominio.
 *
 * Os modulos do Nest registram os seus models a partir daqui:
 *
 * ```ts
 * import { Product, ProductSchema } from '../../schemas.js';
 *
 * MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]);
 * ```
 *
 * Cada schema continua morando no diretorio do seu dominio, em
 * `src/modules/<dominio>/schemas/`. Este arquivo so reune as exportacoes, para
 * que um seed ou um script de manutencao nao precise conhecer a arvore inteira.
 */

// Enumeracoes. Objetos const, nunca `enum` nativo, com os tipos derivados.
export * from './common/enums/fulfillment-mode.js';
export * from './common/enums/institutional-page.js';
export * from './common/enums/order-status.js';
export * from './common/enums/payment-method.js';
export * from './common/enums/user-role.js';

// Infraestrutura comum a todos os schemas.
export {
  BaseSchema,
  EmbeddedSchema,
  baseSchemaOptions,
  embeddedSchemaOptions,
} from './database/base.schema.js';
export { MAX_CENTS } from './database/schema-helpers.js';
export { MAX_SLUG_LENGTH, slugify } from './database/slug.js';
export { SingletonSchema } from './database/singleton.schema.js';

// Acesso e usuarios.
export * from './modules/users/schemas/user.schema.js';
export * from './modules/auth/schemas/refresh-token.schema.js';

// Catalogo.
export * from './modules/categories/schemas/category.schema.js';
export * from './modules/products/schemas/product.schema.js';
export * from './modules/products/schemas/quantity-discount.schema.js';

// Entrega e pagamento.
export * from './modules/delivery/schemas/delivery-city.schema.js';
export * from './modules/payments/schemas/payment-settings.schema.js';
export * from './modules/settings/schemas/store-settings.schema.js';

// Pedidos e clientes.
export * from './modules/orders/schemas/order-code.js';
export * from './modules/orders/schemas/order.schema.js';
export * from './modules/customers/schemas/customer.schema.js';
