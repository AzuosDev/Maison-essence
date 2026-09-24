import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MAX_SLUG_LENGTH, slugify } from '../../../database/slug.js';
import { MAX_IMPORT_CATEGORIES, MAX_IMPORT_PRODUCTS } from '../catalog-import.constants.js';

/**
 * O corpo da rota de importação.
 *
 * ## Por que ele e tão raso
 *
 * Ele valida o **envelope**, e nada dentro dele. A tentação seria declarar
 * `@ValidateNested()` nas duas listas e deixar o pipe conferir os 269
 * produtos — e seria o erro que arruina a rota: um preço digitado errado numa
 * linha faria o pipe recusar o corpo inteiro com 400, e a importação das
 * outras 268 nunca aconteceria.
 *
 * Quem valida produto e categoria e o serviço, um por vez, com o
 * `CreateProductDto` e o `CreateCategoryDto` — os mesmos das rotas do painel.
 * Assim a entrada ruim vira uma linha no relatório e as boas entram.
 *
 * ## Os campos de metadados
 *
 * `generatedAt`, `currency`, `priceUnit` e `notes` não são usados por nada: o
 * arquivo os carrega para quem o lê com os olhos. Estão declarados porque o
 * pipe global roda com `forbidNonWhitelisted` — sem a declaração, colar o
 * arquivo inteiro no corpo devolveria 400 reclamando de `generatedAt`, que e
 * a pior primeira impressão possível para quem só queria importar o catálogo.
 *
 * O `$schema` do arquivo não esta aqui, e nem poderia: o guard de operadores
 * do Mongo recusa qualquer chave iniciada por cifrão antes de o corpo chegar
 * ao pipe. Ele e retirado no parser da rota (ver `bootstrap.ts`), que e o
 * único lugar onde da para faze-lo sem abrir exceção na defesa.
 */
export class ImportCatalogDto {
  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_CATEGORIES)
  @IsObject({ each: true, message: 'cada categoria precisa ser um objeto' })
  categories: Record<string, unknown>[];

  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_PRODUCTS)
  @IsObject({ each: true, message: 'cada produto precisa ser um objeto' })
  products: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  generatedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  priceUnit?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  notes?: string[];
}

/** As duas flags do comando, também pela rota. */
export class ImportCatalogQueryDto {
  /**
   * Simula sem gravar.
   *
   * Vale mais aqui do que no terminal: quem usa a rota e exatamente quem não
   * tem shell para conferir o resultado depois.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  dryRun?: boolean;

  /** Importa um produto só, pelo endereço. Para testar antes da carga. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? slugify(value) : value))
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  only?: string;
}
