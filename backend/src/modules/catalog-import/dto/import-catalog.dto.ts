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
 * O corpo da rota de importacao.
 *
 * ## Por que ele e tao raso
 *
 * Ele valida o **envelope**, e nada dentro dele. A tentacao seria declarar
 * `@ValidateNested()` nas duas listas e deixar o pipe conferir os 269
 * produtos — e seria o erro que arruina a rota: um preco digitado errado numa
 * linha faria o pipe recusar o corpo inteiro com 400, e a importacao das
 * outras 268 nunca aconteceria.
 *
 * Quem valida produto e categoria e o servico, um por vez, com o
 * `CreateProductDto` e o `CreateCategoryDto` — os mesmos das rotas do painel.
 * Assim a entrada ruim vira uma linha no relatorio e as boas entram.
 *
 * ## Os campos de metadados
 *
 * `generatedAt`, `currency`, `priceUnit` e `notes` nao sao usados por nada: o
 * arquivo os carrega para quem o le com os olhos. Estao declarados porque o
 * pipe global roda com `forbidNonWhitelisted` — sem a declaracao, colar o
 * arquivo inteiro no corpo devolveria 400 reclamando de `generatedAt`, que e
 * a pior primeira impressao possivel para quem so queria importar o catalogo.
 *
 * O `$schema` do arquivo nao esta aqui, e nem poderia: o guard de operadores
 * do Mongo recusa qualquer chave iniciada por cifrao antes de o corpo chegar
 * ao pipe. Ele e retirado no parser da rota (ver `bootstrap.ts`), que e o
 * unico lugar onde da para faze-lo sem abrir excecao na defesa.
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

/** As duas flags do comando, tambem pela rota. */
export class ImportCatalogQueryDto {
  /**
   * Simula sem gravar.
   *
   * Vale mais aqui do que no terminal: quem usa a rota e exatamente quem nao
   * tem shell para conferir o resultado depois.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  dryRun?: boolean;

  /** Importa um produto so, pelo endereco. Para testar antes da carga. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? slugify(value) : value))
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  only?: string;
}
