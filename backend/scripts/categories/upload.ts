import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
// Do `dist/`, e nao do `src/`, pelo mesmo motivo que o `banners:upload`: o
// `tsx` roda este arquivo por esbuild, que nao emite `emitDecoratorMetadata`,
// e o `SeedModule` que o `runSeed` sobe tem provider que injeta por tipo.
import { runSeed } from '../../dist/seeds/seed-runner.js';
import { Category } from '../../dist/schemas.js';
import type { CategoryDocument } from '../../dist/schemas.js';
import { CloudinaryService } from '../../dist/modules/uploads/cloudinary.service.js';
import { ART_DIR, CLOUDINARY_CATEGORIES_FOLDER } from './config.js';

/**
 * `npm run categories:upload`
 *
 * Sobe a foto de cada categoria para o Cloudinary e grava o `publicId` no
 * cadastro — o mesmo campo que o painel preenche em "Editar categoria".
 *
 * ```
 * npm run categories:upload -- --dry-run   # so diz o que faria
 * npm run categories:upload
 * npm run categories:upload -- --force     # reenvia foto que ja existe
 * npm run categories:upload -- --dir=./outra
 * ```
 *
 * ## O nome do arquivo e o slug
 *
 * `body-splash.jpg` vai para a categoria de slug `body-splash`. Nao e ordem
 * alfabetica como no `banners:upload`, e a diferenca importa: banner e uma
 * lista ordenada em que a posicao e o que define o banner, enquanto foto de
 * categoria pertence a uma categoria especifica. Casar por posicao aqui poria
 * a foto de hidratante no circulo de desodorante no dia em que alguem
 * cadastrasse uma categoria nova no meio.
 *
 * Arquivo cujo slug nao existe no cadastro nao vira categoria nova: o script
 * avisa e segue. Criar categoria e decisao de quem opera a loja, nao efeito
 * colateral de ter posto um arquivo numa pasta.
 *
 * ## O que este script nao faz
 *
 * Nao apaga foto de categoria que ficou de fora da pasta. Diferente dos
 * banners — que sao a campanha inteira e por isso sao trocados em bloco —, a
 * arvore de categorias e permanente: rodar com um arquivo so precisa trocar
 * aquela foto e deixar as outras seis como estao.
 *
 * Tirar a foto de uma categoria e no painel, no botao "Remover".
 */

interface CliOptions {
  artDir: string;
  force: boolean;
  dryRun: boolean;
}

/** As extensoes que o Cloudinary aceita como imagem e que fazem sentido aqui. */
const ART_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

function parseArgs(argv: readonly string[]): CliOptions {
  const dirFlag = argv.find((arg) => arg.startsWith('--dir='));

  return {
    artDir: dirFlag === undefined ? ART_DIR : resolve(dirFlag.slice('--dir='.length)),
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
  };
}

function artFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => ART_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** O slug que o arquivo nomeia: `body-splash.jpg` -> `body-splash`. */
function slugOf(fileName: string): string {
  return basename(fileName, extname(fileName)).toLowerCase();
}

/** `maison-essence/categories/body-splash`. */
function publicIdOf(slug: string): string {
  return `${CLOUDINARY_CATEGORIES_FOLDER}/${slug}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

async function uploadArt(
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

  const type = MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'image/jpeg';
  const form = new FormData();

  form.set('file', new Blob([readFileSync(filePath)], { type }));

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

  await runSeed('categories:upload', async (app, logger) => {
    const files = artFiles(options.artDir);

    if (files.length === 0) {
      logger.warn(`Nenhuma foto em ${options.artDir}. Nada a fazer.`);

      return;
    }

    const cloudinary = new CloudinaryService(app.get(ConfigService));
    const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));

    let gravadas = 0;
    let enviadas = 0;
    let mantidas = 0;
    let semCategoria = 0;

    for (const fileName of files) {
      const slug = slugOf(fileName);
      const publicId = publicIdOf(slug);
      const filePath = resolve(options.artDir, fileName);

      // eslint-disable-next-line no-await-in-loop -- uma por vez: o log fica legivel e a API do Cloudinary nao ganha com paralelismo aqui.
      const category = await categoryModel.findOne({ slug }).exec();

      if (category === null) {
        logger.warn(`sem categoria com slug "${slug}": ${fileName} ignorado`);
        semCategoria += 1;
        continue;
      }

      const atual = category.image === '' ? '(sem foto)' : category.image;

      if (options.dryRun) {
        logger.log(`[dry-run] ${category.name} [${slug}]: ${atual} -> ${publicId}`);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const existing = await cloudinary.findImage(publicId);

      if (existing !== null && !options.force) {
        logger.log(`ja no Cloudinary, mantida: ${publicId}`);
        mantidas += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop
        await uploadArt(cloudinary, publicId, filePath, options.force);
        logger.log(`enviada: ${fileName} -> ${publicId}`);
        enviadas += 1;
      }

      if (category.image === publicId) {
        continue;
      }

      category.image = publicId;
      // eslint-disable-next-line no-await-in-loop
      await category.save();
      logger.log(`${category.name}: ${atual} -> ${publicId}`);
      gravadas += 1;
    }

    if (options.dryRun) {
      logger.log(`[dry-run] ${String(files.length - semCategoria)} categorias receberiam foto.`);

      return;
    }

    logger.log(`${String(enviadas)} fotos enviadas, ${String(mantidas)} ja estavam la.`);
    logger.log(`${String(gravadas)} categorias apontando para a foto nova.`);

    if (semCategoria > 0) {
      logger.warn(`${String(semCategoria)} arquivos sem categoria correspondente.`);
    }
  });
}

await main();
