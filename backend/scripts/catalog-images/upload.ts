import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
// Do `dist/`, nao do `src/`: `runSeed` sobe o `SeedModule` de verdade, com
// `JwtStrategy` e outros providers que dependem da metadata de decorator que
// so o `tsc` de verdade emite (`emitDecoratorMetadata`). O `tsx` que roda
// este arquivo usa esbuild por baixo, que nao emite essa metadata — rodar o
// modulo do Nest direto por aqui derrubaria a resolucao de dependencia bem
// no primeiro provider que injeta por tipo em vez de por token explicito.
// Import do `dist/` so funciona depois de `npm run build`, e e por isso que
// o script `images:upload` builda antes de chamar este arquivo.
import { runSeed } from '../../dist/seeds/seed-runner.js';
import { Product } from '../../dist/schemas.js';
import type { ProductDocument } from '../../dist/schemas.js';
import { CloudinaryService } from '../../dist/modules/uploads/cloudinary.service.js';
import { CLOUDINARY_PRODUCTS_FOLDER, OUTPUT_DIR } from './config.js';

/**
 * `npm run images:upload`
 *
 * Le `scripts/catalog-images/output/images-map.json` (o que o `images:extract`
 * gerou), sobe cada foto para o Cloudinary com o `publicId` igual ao slug do
 * produto e grava esse `publicId` no campo `images` do produto.
 *
 * ```
 * npm run images:upload
 * npm run images:upload -- --force
 * npm run images:upload -- --map=./outra-pasta/images-map.json
 * ```
 *
 * Idempotente dos dois lados. No Cloudinary: um `publicId` que ja existe e
 * pulado, porque o `images:extract` roda de novo sempre que o fornecedor
 * manda catalogo atualizado, e a foto antiga (talvez ja ajustada a mao no
 * Cloudinary) nao deve ser trocada sem pedir. No banco: um produto que ja tem
 * `images` preenchido — porque a dona subiu foto propria pelo painel — nao e
 * sobrescrito, pela mesma regra do `seed:catalog` (ver a secao "o vazio nunca
 * apaga" no README). `--force` derruba as duas guardas de uma vez: reenvia a
 * foto mesmo que o Cloudinary ja tenha uma, e substitui `images` mesmo que o
 * produto ja tivesse fotos.
 */

interface CliOptions {
  mapPath: string;
  force: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const mapFlag = argv.find((arg) => arg.startsWith('--map='));

  return {
    mapPath: mapFlag !== undefined ? resolve(mapFlag.slice('--map='.length)) : resolve(OUTPUT_DIR, 'images-map.json'),
    force: argv.includes('--force'),
  };
}

interface UploadReport {
  uploaded: number;
  skippedExisting: number;
  failed: number;
  productsUpdated: number;
  productsSkipped: number;
  productsNotFound: string[];
  failures: { slug: string; reason: string }[];
}

function emptyReport(): UploadReport {
  return {
    uploaded: 0,
    skippedExisting: 0,
    failed: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    productsNotFound: [],
    failures: [],
  };
}

async function uploadRawFile(
  cloudinary: CloudinaryService,
  publicId: string,
  filePath: string,
  overwrite: boolean,
): Promise<void> {
  const { cloudName, apiKey } = cloudinary.credentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = { public_id: publicId, timestamp };

  if (overwrite) {
    params.overwrite = 'true';
  }

  const form = new FormData();

  form.set('file', new Blob([readFileSync(filePath)], { type: 'image/webp' }));

  for (const [key, value] of Object.entries(params)) {
    form.set(key, String(value));
  }

  form.set('api_key', apiKey);
  form.set('signature', cloudinary.sign(params));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(`Cloudinary recusou o upload (HTTP ${response.status}): ${body.slice(0, 300)}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  await runSeed('images:upload', async (app, logger) => {
    const imagesMap = JSON.parse(readFileSync(options.mapPath, 'utf8')) as Record<string, string>;
    const entries = Object.entries(imagesMap);
    const mapDir = resolve(options.mapPath, '..');

    const cloudinary = new CloudinaryService(app.get(ConfigService));
    const productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));
    const report = emptyReport();

    for (const [slug, relativeFilePath] of entries) {
      const publicId = `${CLOUDINARY_PRODUCTS_FOLDER}/${slug}`;
      const filePath = resolve(mapDir, relativeFilePath);

      try {
        // eslint-disable-next-line no-await-in-loop -- upload de uma foto de cada vez; a API do Cloudinary nao ganha nada com paralelismo aqui e o log fica legivel.
        const existing = await cloudinary.findImage(publicId);

        if (existing !== null && !options.force) {
          report.skippedExisting += 1;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await uploadRawFile(cloudinary, publicId, filePath, options.force);
          report.uploaded += 1;
        }
      } catch (error: unknown) {
        report.failed += 1;
        report.failures.push({ slug, reason: error instanceof Error ? error.message : String(error) });
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        // `variants` entra na projecao mesmo sem ser lido aqui: o hook
        // `pre('validate')` do Product confere `this.variants.length`, e um
        // documento parcial sem essa selecao quebra o `.save()` com "Cannot
        // read properties of undefined" — o hook roda contra o que o
        // Mongoose tem em maos, nao contra o banco.
        const product = await productModel.findOne({ slug }).select('images variants').exec();

        if (product === null) {
          report.productsNotFound.push(slug);
          continue;
        }

        if (product.images.length > 0 && !options.force) {
          report.productsSkipped += 1;
          continue;
        }

        product.images = [publicId];
        // eslint-disable-next-line no-await-in-loop
        await product.save();
        report.productsUpdated += 1;
      } catch (error: unknown) {
        report.failed += 1;
        report.failures.push({ slug, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.log(`Cloudinary   ${report.uploaded} enviadas, ${report.skippedExisting} ja existiam, ${report.failed} falharam`);
    logger.log(
      `Banco        ${report.productsUpdated} atualizados, ${report.productsSkipped} ja tinham foto, ${report.productsNotFound.length} sem produto`,
    );

    if (report.productsNotFound.length > 0) {
      logger.warn(`Slugs sem produto no banco: ${report.productsNotFound.join(', ')}`);
    }

    if (report.failures.length > 0) {
      logger.error('Falhas:');

      for (const failure of report.failures) {
        logger.error(`  ${failure.slug}: ${failure.reason}`);
      }

      process.exitCode = 1;
    }
  });
}

await main();
