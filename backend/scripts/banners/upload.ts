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
 * npm run banners:upload -- --inactive     # registra sem publicar na home
 * ```
 *
 * `--inactive` e para a campanha que vai ao ar depois: as artes sobem, os
 * banners ficam cadastrados com o par certo, e a home nao muda enquanto
 * ninguem os ligar no painel. Sem a opcao, o que sobe ja esta na vitrine.
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
 * ## As duas artes de cada banner
 *
 * `01-campanha.png` e a de computador (1920 x 562) e
 * `01-campanha-mobile.png` e a de celular (1200 x 1500) do mesmo banner. Sem
 * o par, o script repete a arte larga no celular e a home mostra uma tira do
 * meio dela — que e o que o sufixo existe para evitar.
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
  inactive: boolean;
}

/** As extensoes que o Cloudinary aceita como imagem e que fazem sentido aqui. */
const ART_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

function parseArgs(argv: readonly string[]): CliOptions {
  const dirFlag = argv.find((arg) => arg.startsWith('--dir='));

  return {
    artDir: dirFlag === undefined ? ART_DIR : resolve(dirFlag.slice('--dir='.length)),
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    inactive: argv.includes('--inactive'),
  };
}

/** O sufixo que marca a arte de celular do mesmo banner. */
const MOBILE_SUFFIX = '-mobile';

/** Um banner da pasta: a arte de computador e, quando existe, a de celular. */
interface ArtPair {
  desktop: string;
  mobile: string | undefined;
}

/**
 * As artes da pasta, em ordem de nome, ja emparelhadas.
 *
 * Ordem alfabetica, e nao ordem do sistema de arquivos: `readdir` devolve na
 * ordem que o disco tiver, que muda de maquina para maquina. O carrossel tem
 * uma ordem visivel para o cliente, e ela nao pode depender disso — quem
 * numera os arquivos (`01-`, `02-`) esta escolhendo a ordem do carrossel.
 *
 * ## As duas artes do mesmo banner
 *
 * `01-campanha.png` e a arte de computador; `01-campanha-mobile.png` e a do
 * celular do mesmo banner, e nao um segundo banner. O sufixo e o que
 * emparelha, porque e o que a dona consegue conferir olhando a pasta.
 *
 * Antes nao havia par: o script gravava o arquivo largo tambem no
 * `imageMobile`, e a home espremia uma faixa de 1920x562 na caixa retrato do
 * telefone. A arte de celular so entrava depois, uma a uma, pelo painel.
 *
 * Arte de celular sem a de computador do mesmo nome fica de fora, com aviso:
 * sozinha ela nao da um banner — `imageDesktop` e o campo obrigatorio.
 */
function artPairs(dir: string, warn: (message: string) => void): ArtPair[] {
  const files = readdirSync(dir)
    .filter((name) => ART_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const isMobile = (name: string): boolean => basename(name, extname(name)).endsWith(MOBILE_SUFFIX);

  const mobileOf = new Map<string, string>();

  for (const name of files.filter(isMobile)) {
    const stem = basename(name, extname(name)).slice(0, -MOBILE_SUFFIX.length);

    mobileOf.set(stem, name);
  }

  const pairs = files
    .filter((name) => !isMobile(name))
    .map((desktop) => ({
      desktop,
      mobile: mobileOf.get(basename(desktop, extname(desktop))),
    }));

  const used = new Set(pairs.map((pair) => pair.mobile));

  for (const name of files.filter(isMobile)) {
    if (!used.has(name)) {
      warn(`arte de celular sem a de computador do mesmo nome, ignorada: ${name}`);
    }
  }

  return pairs;
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
    const pairs = artPairs(options.artDir, (message) => {
      logger.warn(message);
    });

    if (pairs.length === 0) {
      logger.warn(`Nenhuma arte em ${options.artDir}. Nada a fazer.`);

      return;
    }

    const cloudinary = new CloudinaryService(app.get(ConfigService));
    const settingsModel = app.get<StoreSettingsModel>(getModelToken(StoreSettings.name));

    const registered: { desktop: string; mobile: string }[] = [];
    let uploaded = 0;
    let skipped = 0;

    // Sobe um arquivo e devolve o `publicId` dele. A arte que ja esta no
    // Cloudinary nao e reenviada — `--force` reenvia.
    const send = async (fileName: string): Promise<string> => {
      const publicId = publicIdOf(fileName);
      const existing = await cloudinary.findImage(publicId);

      if (existing !== null && !options.force) {
        logger.log(`ja no Cloudinary, mantida: ${publicId}`);
        skipped += 1;

        return publicId;
      }

      await uploadArt(cloudinary, publicId, resolve(options.artDir, fileName), options.force);
      logger.log(`enviada: ${fileName} -> ${publicId}`);
      uploaded += 1;

      return publicId;
    };

    for (const pair of pairs) {
      if (options.dryRun) {
        const mobile =
          pair.mobile === undefined
            ? 'sem arte de celular — a de computador serve as duas'
            : `celular ${pair.mobile}`;

        logger.log(`[dry-run] ${pair.desktop} -> ${publicIdOf(pair.desktop)} (${mobile})`);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- uma arte por vez: o log fica legivel e a API do Cloudinary nao ganha nada com paralelismo aqui.
      const desktop = await send(pair.desktop);
      // eslint-disable-next-line no-await-in-loop
      const mobile = pair.mobile === undefined ? desktop : await send(pair.mobile);

      registered.push({ desktop, mobile });
    }

    if (options.dryRun) {
      logger.log(`[dry-run] ${String(pairs.length)} banners seriam registrados, nesta ordem.`);

      return;
    }

    const settings = await settingsModel.getOrCreate();

    // O que sai da home fica registrado no log antes de a gravacao acontecer:
    // a arte continua no Cloudinary, mas quem rodou o script precisa saber o
    // que deixou de aparecer sem ter de comparar duas telas.
    const entrando = new Set(registered.map((banner) => banner.desktop));

    for (const anterior of settings.banners) {
      if (!entrando.has(anterior.imageDesktop)) {
        logger.warn(`sai da home: ${anterior.imageDesktop}`);
      }
    }

    // Sem titulo, chamada nem botao: e o que faz a vitrine desenhar a arte de
    // ponta a ponta em vez de montar foto + bloco de texto por cima dela.
    // `imageMobile` recebe o arquivo `-mobile` do par, e so cai no de
    // computador quando a pasta nao trouxe um: uma faixa de 1920x562 na
    // caixa retrato do telefone perde quase tudo o que esta desenhado nela.
    settings.banners = registered.map((banner, index) => ({
      imageDesktop: banner.desktop,
      imageMobile: banner.mobile,
      title: '',
      subtitle: '',
      buttonLabel: '',
      link: '',
      order: index,
      startsAt: null,
      endsAt: null,
      isActive: !options.inactive,
    })) as StoreSettingsDocument['banners'];

    await settings.save();

    logger.log(`${String(uploaded)} artes enviadas, ${String(skipped)} ja estavam la.`);
    logger.log(
      options.inactive
        ? `${String(registered.length)} banners cadastrados inativos: ligue cada um no painel.`
        : `${String(registered.length)} banners na home, nesta ordem.`,
    );
  });
}

await main();
