import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
// Do `dist/`, e nao do `src/`, pelo mesmo motivo que o `images:upload`: o
// `tsx` roda este arquivo por esbuild, que nao emite `emitDecoratorMetadata`,
// e o `SeedModule` que o `runSeed` sobe tem provider que injeta por tipo.
// Por isso o script `banners:upload` builda antes de chamar este arquivo.
import { runSeed } from '../../dist/seeds/seed-runner.js';
import { StoreSettings } from '../../dist/schemas.js';
import type { StoreSettingsDocument, StoreSettingsModel } from '../../dist/schemas.js';
import { CloudinaryService } from '../../dist/modules/uploads/cloudinary.service.js';
import { ART_DIR, CLOUDINARY_BANNERS_FOLDER } from './config.js';

/**
 * `npm run banners:upload`
 *
 * Sobe cada arquivo de `scripts/banners/art/` para o Cloudinary e registra os
 * banners da home na ordem alfabetica do nome do arquivo.
 *
 * ```
 * npm run banners:upload
 * npm run banners:upload -- --force        # reenvia arte que ja existe
 * npm run banners:upload -- --dir=./outra  # outra pasta de arte
 * npm run banners:upload -- --dry-run      # so diz o que faria
 * ```
 *
 * ## Por que os banners saem sem titulo
 *
 * A arte que este script sobe e cartaz: logo, frase e chamada ja estao
 * desenhados dentro do arquivo. Banner sem `title`, `subtitle` nem
 * `buttonLabel` cadastrados e o que a vitrine trata como arte inteira — ela
 * larga a grade de foto + bloco de texto, tira o veu e desenha o arquivo de
 * ponta a ponta. Escrever um titulo aqui faria a loja sobrepor texto ao texto
 * que ja esta na imagem.
 *
 * O nome do arquivo vira o `publicId`, entao ele e o identificador de
 * verdade: renomear a arte e subir de novo cria outro banner em vez de
 * substituir o que estava la.
 *
 * ## A pasta e a lista
 *
 * Os banners da home passam a ser exatamente o que esta em `art/`, nessa
 * ordem. O que estava registrado antes sai da home — e por isso o script
 * imprime o que vai tirar antes de gravar, e por isso o `--dry-run` existe.
 *
 * A arte antiga continua no Cloudinary: sair da home e sair da vitrine, nao
 * do acervo. Voltar atras e por o arquivo de volta na pasta e rodar de novo,
 * ou reapontar pelo painel.
 *
 * Ajuste fino de um banner — link, periodo de exibicao, imagem propria para
 * o celular — e trabalho de painel. Este script serve para trocar a campanha
 * inteira de uma vez.
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

/**
 * As artes da pasta, em ordem de nome.
 *
 * Ordem alfabetica, e nao ordem do sistema de arquivos: `readdir` devolve na
 * ordem que o disco tiver, que muda de maquina para maquina. O carrossel tem
 * uma ordem visivel para o cliente, e ela nao pode depender disso — quem
 * numera os arquivos (`01-`, `02-`) esta escolhendo a ordem do carrossel.
 */
function artFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => ART_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** O `publicId` do arquivo, sem a extensao: `maison-essence/banners/01-marca`. */
function publicIdOf(fileName: string): string {
  return `${CLOUDINARY_BANNERS_FOLDER}/${basename(fileName, extname(fileName))}`;
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

  const type = MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'image/png';
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

  await runSeed('banners:upload', async (app, logger) => {
    const files = artFiles(options.artDir);

    if (files.length === 0) {
      logger.warn(`Nenhuma arte em ${options.artDir}. Nada a fazer.`);

      return;
    }

    const cloudinary = new CloudinaryService(app.get(ConfigService));
    const settingsModel = app.get<StoreSettingsModel>(getModelToken(StoreSettings.name));

    const publicIds: string[] = [];
    let uploaded = 0;
    let skipped = 0;

    for (const fileName of files) {
      const publicId = publicIdOf(fileName);
      const filePath = resolve(options.artDir, fileName);

      publicIds.push(publicId);

      if (options.dryRun) {
        logger.log(`[dry-run] ${fileName} -> ${publicId}`);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- uma arte por vez: o log fica legivel e a API do Cloudinary nao ganha nada com paralelismo aqui.
      const existing = await cloudinary.findImage(publicId);

      if (existing !== null && !options.force) {
        logger.log(`ja no Cloudinary, mantida: ${publicId}`);
        skipped += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await uploadArt(cloudinary, publicId, filePath, options.force);
      logger.log(`enviada: ${fileName} -> ${publicId}`);
      uploaded += 1;
    }

    if (options.dryRun) {
      logger.log(`[dry-run] ${String(files.length)} banners seriam registrados, nesta ordem.`);

      return;
    }

    const settings = await settingsModel.getOrCreate();

    // O que sai da home fica registrado no log antes de a gravacao acontecer:
    // a arte continua no Cloudinary, mas quem rodou o script precisa saber o
    // que deixou de aparecer sem ter de comparar duas telas.
    for (const anterior of settings.banners) {
      if (!publicIds.includes(anterior.imageDesktop)) {
        logger.warn(`sai da home: ${anterior.imageDesktop}`);
      }
    }

    // Sem titulo, chamada nem botao: e o que faz a vitrine desenhar a arte de
    // ponta a ponta em vez de montar foto + bloco de texto por cima dela.
    // `imageMobile` recebe o mesmo arquivo — uma faixa larga num telefone de
    // 390px fica com o texto minusculo, e a versao em retrato e trabalho de
    // painel.
    settings.banners = publicIds.map((publicId, index) => ({
      imageDesktop: publicId,
      imageMobile: publicId,
      title: '',
      subtitle: '',
      buttonLabel: '',
      link: '',
      order: index,
      startsAt: null,
      endsAt: null,
      isActive: true,
    })) as StoreSettingsDocument['banners'];

    await settings.save();

    logger.log(`${String(uploaded)} artes enviadas, ${String(skipped)} ja estavam la.`);
    logger.log(`${String(publicIds.length)} banners na home, nesta ordem.`);
  });
}

await main();
