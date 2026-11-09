import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
// Do `dist/`, e nao do `src/`, pelo mesmo motivo que o `categories:upload`: o
// `tsx` roda este arquivo por esbuild, que nao emite `emitDecoratorMetadata`,
// e o `SeedModule` que o `runSeed` sobe tem provider que injeta por tipo.
import { runSeed } from '../../dist/seeds/seed-runner.js';
import { Category, Product, StoreSettings } from '../../dist/schemas.js';
import type { CategoryDocument, StoreSettingsModel } from '../../dist/schemas.js';
import { CloudinaryService } from '../../dist/modules/uploads/cloudinary.service.js';
import { cutBackground } from './art.js';
import {
  ART_DIR,
  BRAND_PREFIX,
  CATEGORY_PREFIX,
  CLOUDINARY_SHORTCUTS_FOLDER,
  SHORTCUTS,
  type PlannedShortcut,
} from './config.js';

/**
 * `npm run shortcuts:upload`
 *
 * Sobe a foto de cada atalho da home para o Cloudinary e grava a fileira
 * inteira nas configuracoes da loja — a mesma lista que a dona edita em
 * Ajustes › Atalhos da home.
 *
 * ```
 * npm run shortcuts:upload -- --dry-run            # so diz o que faria
 * npm run shortcuts:upload -- --dir=../fotos
 * npm run shortcuts:upload
 * npm run shortcuts:upload -- --force              # reenvia foto que ja existe
 * npm run shortcuts:upload -- --criar-categorias   # cria as categorias que faltam
 * ```
 *
 * ## A lista manda, e a pasta so da as fotos
 *
 * Quem decide a fileira e `config.ts`: ordem, nome e destino de cada circulo.
 * O nome do arquivo casa com o campo `file` do atalho, sem diferenciar
 * maiusculas nem acentos — `MAIS VENDIDOS.jpg` e o atalho "Mais vendidos".
 *
 * Casar por posicao na pasta, como o `banners:upload` faz, poria a foto de
 * "Masculino" no circulo de "Feminino" no dia em que alguem renomeasse um
 * arquivo. Aqui a foto pertence a um atalho especifico.
 *
 * Atalho sem arquivo correspondente **continua entrando na fileira**, sem
 * foto: o circulo cai na inicial do nome, que e o estado vazio que a home ja
 * desenha. Nome e destino sao o que o atalho precisa; a foto e acabamento.
 *
 * ## O fundo branco sai no caminho
 *
 * A home nao recorta mais a foto num circulo: o disco dourado da arte e o
 * circulo, e o frasco que passa dele aparece por fora. Para isso o que estiver
 * entre o disco e a quina do arquivo precisa ser transparente, e JPEG nao tem
 * transparencia. Cada arte passa por `cutBackground` antes de subir e vai para
 * a conta como PNG. Ver `art.ts`.
 *
 * E por isso que a arte que ja esta na conta em outro formato e reenviada
 * mesmo sem `--force`: o JPEG antigo na mesma vaga desenharia um quadrado
 * branco em volta de cada circulo.
 *
 * ## A fileira vai inteira
 *
 * As configuracoes passam a ter exatamente os atalhos desta lista, nesta
 * ordem. O que estava gravado antes sai da home — e por isso o script imprime
 * o que vai tirar antes de gravar, e por isso o `--dry-run` existe.
 *
 * Rodar duas vezes nao duplica nada: o `_id` de cada atalho e preservado pelo
 * destino, que e o que ha de estavel entre uma gravacao e outra.
 *
 * ## O que ele confere antes de gravar
 *
 * Todo destino e conferido contra o cadastro, e o que nao resolve vira aviso
 * escrito em vez de um circulo que leva a uma pagina vazia:
 *
 * - **categoria** que nao existe na arvore;
 * - **marca** que nenhum produto do catalogo tem escrita no cadastro.
 *
 * O aviso nao impede a gravacao de proposito: a dona pode estar montando a
 * fileira antes de cadastrar os produtos. O que ela nao pode e descobrir isso
 * pela cliente que tocou no circulo.
 */

interface CliOptions {
  artDir: string;
  force: boolean;
  dryRun: boolean;
  criarCategorias: boolean;
}

/** As extensoes que o Cloudinary aceita como imagem e que fazem sentido aqui. */
const ART_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

/** O formato que sobe, sempre: e o que guarda a transparencia do recorte. */
const UPLOAD_FORMAT = 'png';

function parseArgs(argv: readonly string[]): CliOptions {
  const dirFlag = argv.find((arg) => arg.startsWith('--dir='));

  return {
    artDir: dirFlag === undefined ? ART_DIR : resolve(dirFlag.slice('--dir='.length)),
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    criarCategorias: argv.includes('--criar-categorias'),
  };
}

/**
 * O nome do arquivo reduzido ao que casa com o campo `file` do atalho.
 *
 * Sem extensao, sem acento, sem maiuscula e sem espaco repetido. A dupla
 * extensao que o celular as vezes produz — `FOTO.jpg.jpeg` — e desfeita ate o
 * fim, senao `MAIS VENDIDOS.jpg.jpeg` viraria o atalho "mais vendidos.jpg".
 */
function keyOf(fileName: string): string {
  let name = fileName;

  while (ART_EXTENSIONS.has(extname(name).toLowerCase())) {
    name = basename(name, extname(name));
  }

  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** As fotos da pasta, indexadas pelo atalho a que pertencem. */
function artByKey(dir: string): Map<string, string> {
  const files = readdirSync(dir).filter((name) =>
    ART_EXTENSIONS.has(extname(name).toLowerCase()),
  );

  return new Map(files.map((name) => [keyOf(name), resolve(dir, name)]));
}

/** O id que ja existia, ou um novo. Ver a nota sobre `idByLink`. */
function objectIdOf(id: string | undefined): Types.ObjectId {
  return id === undefined ? new Types.ObjectId() : new Types.ObjectId(id);
}

/** `maison-essence/shortcuts/mais-vendidos`. */
function publicIdOf(shortcut: PlannedShortcut): string {
  return `${CLOUDINARY_SHORTCUTS_FOLDER}/${shortcut.slug}`;
}

/**
 * Sobe a arte ja recortada.
 *
 * `invalidate` junto do `overwrite` porque trocar o arquivo na mesma vaga nao
 * basta: sem limpar o CDN, a regiao que ja tinha a versao antiga em cache
 * continuaria servindo o JPEG de fundo branco por horas.
 */
async function uploadArt(
  cloudinary: CloudinaryService,
  publicId: string,
  art: Buffer,
  overwrite: boolean,
): Promise<void> {
  const { cloudName, apiKey } = cloudinary.credentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = { public_id: publicId, timestamp };

  if (overwrite) {
    params.overwrite = 'true';
    params.invalidate = 'true';
  }

  const form = new FormData();

  form.set('file', new Blob([art], { type: `image/${UPLOAD_FORMAT}` }));

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

  await runSeed('shortcuts:upload', async (app, logger) => {
    const art = artByKey(options.artDir);

    const cloudinary = new CloudinaryService(app.get(ConfigService));
    const settingsModel = app.get<StoreSettingsModel>(getModelToken(StoreSettings.name));
    const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));
    const productModel = app.get<Model<Product>>(getModelToken(Product.name));

    const settings = await settingsModel.getOrCreate();

    /*
     * O `_id` de cada atalho e preservado pelo destino.
     *
     * E o unico campo que nao muda entre uma rodada e outra — nome e foto
     * podem ser reescritos. Sem isso, rodar o script duas vezes trocaria
     * todos os ids, e o modulo de uploads perderia a conta de quais fotos
     * ainda estao em uso.
     */
    const idByLink = new Map(
      settings.shortcuts.map((shortcut) => [shortcut.link, shortcut.id]),
    );

    const saindo = settings.shortcuts.filter(
      (shortcut) => !SHORTCUTS.some((planned) => planned.link === shortcut.link),
    );

    for (const shortcut of saindo) {
      logger.warn(`sai da fileira: ${shortcut.label} (${shortcut.link})`);
    }

    const planejados: Record<string, unknown>[] = [];
    let enviadas = 0;
    let mantidas = 0;
    let semFoto = 0;

    for (const [index, planned] of SHORTCUTS.entries()) {
      const filePath = art.get(planned.file);
      const publicId = publicIdOf(planned);

      // ---- A foto -------------------------------------------------------
      let image = '';

      if (filePath === undefined) {
        logger.warn(`sem foto para "${planned.label}": o circulo fica com a inicial do nome`);
        semFoto += 1;
      } else if (options.dryRun) {
        logger.log(
          `[dry-run] ${planned.label}: ${basename(filePath)} -> ${publicId} (recortada e enviada como PNG)`,
        );
        image = publicId;
      } else {
        // eslint-disable-next-line no-await-in-loop -- uma por vez: o log fica legivel e a API do Cloudinary nao ganha com paralelismo aqui.
        const existing = await cloudinary.findImage(publicId);

        /*
         * Arte guardada em outro formato e arte de antes do recorte: ela sobe
         * de novo mesmo sem `--force`, senao o JPEG de fundo branco ficaria
         * desenhando um quadrado em volta do circulo.
         */
        if (existing !== null && existing.format === UPLOAD_FORMAT && !options.force) {
          logger.log(`ja recortada no Cloudinary, mantida: ${publicId}`);
          mantidas += 1;
        } else {
          // eslint-disable-next-line no-await-in-loop
          const { buffer, cutRatio } = await cutBackground(filePath);
          // eslint-disable-next-line no-await-in-loop
          await uploadArt(cloudinary, publicId, buffer, existing !== null);
          logger.log(
            `enviada: ${basename(filePath)} -> ${publicId} (${(cutRatio * 100).toFixed(0)}% do quadrado virou transparencia)`,
          );
          enviadas += 1;
        }

        image = publicId;
      }

      // ---- O destino ----------------------------------------------------
      if (planned.link.startsWith(CATEGORY_PREFIX)) {
        const slug = planned.link.slice(CATEGORY_PREFIX.length);
        // eslint-disable-next-line no-await-in-loop
        const category = await categoryModel.findOne({ slug }).exec();

        if (category === null) {
          if (options.criarCategorias && !options.dryRun) {
            // eslint-disable-next-line no-await-in-loop
            await categoryModel.create({
              name: planned.label,
              slug,
              parentId: null,
              order: index,
              isActive: true,
            });
            logger.log(`categoria criada, ainda sem produto: ${planned.label} [${slug}]`);
          } else {
            logger.warn(
              `a categoria "${slug}" nao existe: o circulo "${planned.label}" leva a uma pagina vazia. Use --criar-categorias ou crie no painel.`,
            );
          }
        }
      } else if (planned.link.startsWith(BRAND_PREFIX)) {
        const brand = decodeURIComponent(planned.link.slice(BRAND_PREFIX.length));
        // eslint-disable-next-line no-await-in-loop
        const quantos = await productModel.countDocuments({ brand }).exec();

        if (quantos === 0) {
          logger.warn(
            `nenhum produto com a marca "${brand}": o circulo "${planned.label}" leva a uma vitrine vazia ate alguem escrever a marca no cadastro.`,
          );
        } else {
          logger.log(`${planned.label}: ${String(quantos)} produtos com a marca "${brand}"`);
        }
      }

      planejados.push({
        _id: objectIdOf(idByLink.get(planned.link)),
        label: planned.label,
        image,
        link: planned.link,
        order: index,
        isActive: true,
      });
    }

    if (options.dryRun) {
      logger.log(`[dry-run] a fileira ficaria com ${String(SHORTCUTS.length)} atalhos:`);

      for (const [index, planned] of SHORTCUTS.entries()) {
        logger.log(`[dry-run]   ${String(index + 1)}. ${planned.label} -> ${planned.link}`);
      }

      return;
    }

    settings.set('shortcuts', planejados);
    await settings.save();

    logger.log(`${String(enviadas)} fotos enviadas, ${String(mantidas)} ja estavam la.`);
    logger.log(`fileira gravada com ${String(SHORTCUTS.length)} atalhos.`);

    if (semFoto > 0) {
      logger.warn(`${String(semFoto)} atalhos ficaram sem foto.`);
    }
  });
}

await main();
