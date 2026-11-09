import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import sharp from 'sharp';
// Do `dist/`, e nao do `src/`, pelo mesmo motivo que o `shortcuts:upload`: o
// `tsx` roda este arquivo por esbuild, que nao emite `emitDecoratorMetadata`,
// e o `SeedModule` que o `runSeed` sobe tem provider que injeta por tipo.
import { runSeed } from '../../dist/seeds/seed-runner.js';
import { Category, Product, StoreSettings } from '../../dist/schemas.js';
import type { CategoryDocument, StoreSettingsModel } from '../../dist/schemas.js';
import { CloudinaryService } from '../../dist/modules/uploads/cloudinary.service.js';
import {
  ART_DIR,
  BRAND_PREFIX,
  CATEGORY_PREFIX,
  CLOUDINARY_POSTERS_FOLDER,
  POSTERS,
  POSTER_MIN_WIDTH,
  POSTER_RATIO,
  type PlannedPoster,
} from './config.js';

/**
 * `npm run posters:upload`
 *
 * Sobe a arte de cada cartaz de colecao e grava a faixa inteira nas
 * configuracoes da loja — a mesma lista que o painel edita.
 *
 * ```
 * npm run posters:upload -- --dir=../fotos-colecao --dry-run   # so diz o que faria
 * npm run posters:upload -- --dir=../fotos-colecao
 * npm run posters:upload -- --dir=../fotos-colecao --force     # reenvia arte que ja existe
 * ```
 *
 * ## A lista manda, e a pasta so da as artes
 *
 * Quem decide a faixa e `config.ts`: ordem, nome e destino de cada cartaz. O
 * nome do arquivo casa com o campo `file`, sem diferenciar maiusculas, acento
 * nem extensao dupla — `MAIS VENDIDOS.jpg` e o cartaz "Mais vendidos".
 *
 * **Cartaz sem arquivo correspondente nao entra na faixa**, ao contrario do
 * atalho sem foto. O circulo sem foto cai na inicial do nome e continua um
 * atalho; o cartaz sem arte e um retangulo cinza de meia tela no meio da
 * vitrine, e a home se recusa a desenha-lo. Recusar aqui e dizer o mesmo uma
 * etapa antes, onde ha quem leia o aviso.
 *
 * ## O enquadramento e conferido, e nao corrigido
 *
 * A moldura da home e 16:9 fixa, com `object-fit: cover`: arte de outra
 * proporcao e cortada pelo centro, e arte menor que 1200px de largura chega
 * mole no monitor retina. As duas coisas viram aviso escrito com a medida
 * encontrada — e aviso, e nao recorte automatico, porque cortar uma arte pelo
 * centro e exatamente o que ninguem quer que aconteca calado.
 *
 * ## A arte sobe como ela e
 *
 * Sem recorte de fundo, ao contrario do `shortcuts:upload`: o cartaz e uma
 * paisagem cheia, e o fundo dela e parte da arte. O arquivo vai para a conta
 * no formato em que chegou.
 *
 * ## O endereco da arte carrega a impressao digital dela
 *
 * `maison-essence/posters/mais-vendidos-3f9c21a8`. O sufixo sai do conteudo
 * do arquivo, porque a entrega do Cloudinary manda o navegador guardar a foto
 * por 30 dias: com nome fixo, trocar a arte nao troca a foto de quem ja
 * visitou a loja. Arte nova, endereco novo, e a troca aparece para todo mundo.
 *
 * A arte que sai de cena e removida da conta depois que a faixa nova esta
 * gravada — senao cada troca deixaria um arquivo morto que ninguem mais ve.
 *
 * ## A faixa vai inteira
 *
 * As configuracoes passam a ter exatamente os cartazes desta lista, nesta
 * ordem. O que estava gravado antes sai da home — e por isso o script imprime
 * o que vai tirar antes de gravar, e por isso o `--dry-run` existe.
 *
 * Rodar duas vezes nao duplica nada: o `_id` de cada cartaz e preservado pelo
 * destino, que e o que ha de estavel entre uma gravacao e outra.
 *
 * ## O que ele confere antes de gravar
 *
 * Todo destino e conferido contra o cadastro, e o que nao resolve vira aviso
 * escrito em vez de um cartaz que leva a uma pagina vazia: categoria que nao
 * existe na arvore, e marca que nenhum produto tem escrita no cadastro.
 */

interface CliOptions {
  artDir: string;
  force: boolean;
  dryRun: boolean;
}

/** As extensoes que o Cloudinary aceita como imagem e que fazem sentido aqui. */
const ART_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

/** O tipo que cada extensao declara no envio. */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/** Quanto a proporcao pode fugir de 16:9 antes de o corte aparecer na tela. */
const RATIO_TOLERANCE = 0.02;

function parseArgs(argv: readonly string[]): CliOptions {
  const dirFlag = argv.find((arg) => arg.startsWith('--dir='));

  return {
    artDir: dirFlag === undefined ? ART_DIR : resolve(dirFlag.slice('--dir='.length)),
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
  };
}

/**
 * O nome do arquivo reduzido ao que casa com o campo `file` do cartaz.
 *
 * Sem extensao, sem acento, sem maiuscula e sem espaco repetido. A dupla
 * extensao que o celular as vezes produz — `FOTO.jpg.jpeg` — e desfeita ate o
 * fim, senao `MAIS VENDIDOS.jpg.jpeg` viraria o cartaz "mais vendidos.jpg".
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

/** As artes da pasta, indexadas pelo cartaz a que pertencem. */
function artByKey(dir: string): Map<string, string> {
  const files = readdirSync(dir).filter((name) => ART_EXTENSIONS.has(extname(name).toLowerCase()));

  return new Map(files.map((name) => [keyOf(name), resolve(dir, name)]));
}

/** O id que ja existia, ou um novo. Ver a nota sobre `idByLink`. */
function objectIdOf(id: string | undefined): Types.ObjectId {
  return id === undefined ? new Types.ObjectId() : new Types.ObjectId(id);
}

/**
 * `maison-essence/posters/mais-vendidos-3f9c21a8`.
 *
 * O sufixo e a impressao digital do arquivo, e ele existe porque a entrega do
 * Cloudinary manda o navegador guardar a foto por **30 dias**. Com o nome
 * fixo, trocar a arte na mesma vaga nao troca a foto de quem ja esteve na
 * loja: o `invalidate` limpa o CDN, e nao o disco de quem visitou.
 */
function publicIdOf(poster: PlannedPoster, art: Buffer): string {
  const digest = createHash('sha1').update(art).digest('hex').slice(0, 8);

  return `${CLOUDINARY_POSTERS_FOLDER}/${poster.slug}-${digest}`;
}

/** O que a arte tem de errado para a moldura da home, ou `null`. */
async function framingProblem(filePath: string): Promise<string | null> {
  const { width, height, format } = await sharp(filePath).metadata();

  if (width === undefined || height === undefined) {
    return 'nao deu para ler a medida do arquivo';
  }

  const ratio = width / height;
  const medida = `${String(width)}x${String(height)} (${String(format)})`;

  if (Math.abs(ratio - POSTER_RATIO) > RATIO_TOLERANCE) {
    const sobra = ratio > POSTER_RATIO ? 'as laterais' : 'o topo e o pe';

    return `${medida} nao e 16:9 — a home corta ${sobra} pelo centro`;
  }

  if (width < POSTER_MIN_WIDTH) {
    return `${medida} e menor que ${String(POSTER_MIN_WIDTH)}px de largura — chega mole no monitor retina`;
  }

  return null;
}

/**
 * Sobe a arte como ela e.
 *
 * Reescrever a mesma vaga so acontece com `--force`, ja que o endereco muda
 * sozinho quando a arte muda. Quando acontece, vai com `invalidate`: trocar o
 * arquivo sem limpar o CDN deixaria as regioes que ja tinham a versao antiga
 * servindo ela por horas.
 */
async function uploadArt(
  cloudinary: CloudinaryService,
  publicId: string,
  art: Buffer,
  mime: string,
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

  form.set('file', new Blob([art], { type: mime }));

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

  await runSeed('posters:upload', async (app, logger) => {
    const art = artByKey(options.artDir);

    const cloudinary = new CloudinaryService(app.get(ConfigService));
    const settingsModel = app.get<StoreSettingsModel>(getModelToken(StoreSettings.name));
    const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));
    const productModel = app.get<Model<Product>>(getModelToken(Product.name));

    const settings = await settingsModel.getOrCreate();

    /*
     * O `_id` de cada cartaz e preservado pelo destino.
     *
     * E o unico campo que nao muda entre uma rodada e outra — nome e arte
     * podem ser reescritos. Sem isso, rodar o script duas vezes trocaria
     * todos os ids, e o modulo de uploads perderia a conta de quais artes
     * ainda estao em uso.
     */
    const idByLink = new Map(settings.posters.map((poster) => [poster.link, poster.id]));

    /* Lida antes de a faixa nova ser gravada por cima: e com ela que o fim do
       script descobre qual arte deixou de ser usada. */
    const artesAntigas = settings.posters.map((poster) => poster.image);

    const saindo = settings.posters.filter(
      (poster) => !POSTERS.some((planned) => planned.link === poster.link),
    );

    for (const poster of saindo) {
      logger.warn(`sai da faixa: ${poster.label} (${poster.link})`);
    }

    const planejados: Record<string, unknown>[] = [];
    let enviadas = 0;
    let mantidas = 0;

    for (const [index, planned] of POSTERS.entries()) {
      const filePath = art.get(planned.file);

      // ---- A arte -------------------------------------------------------
      if (filePath === undefined) {
        logger.warn(
          `sem arte para "${planned.label}": o cartaz fica de fora da faixa, porque cartaz sem arte e um retangulo cinza.`,
        );
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- uma por vez: o log fica legivel.
      const problema = await framingProblem(filePath);

      if (problema !== null) {
        logger.warn(`"${planned.label}": ${problema}`);
      }

      const buffer = readFileSync(filePath);
      const publicId = publicIdOf(planned, buffer);
      const mime = MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'image/jpeg';

      if (options.dryRun) {
        logger.log(`[dry-run] ${planned.label}: ${basename(filePath)} -> ${publicId}`);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const existing = await cloudinary.findImage(publicId);

        if (existing !== null && !options.force) {
          logger.log(`esta arte ja esta na conta, mantida: ${publicId}`);
          mantidas += 1;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await uploadArt(cloudinary, publicId, buffer, mime, options.force);
          logger.log(`enviada: ${basename(filePath)} -> ${publicId}`);
          enviadas += 1;
        }
      }

      // ---- O destino ----------------------------------------------------
      if (planned.link.startsWith(CATEGORY_PREFIX)) {
        const slug = planned.link.slice(CATEGORY_PREFIX.length);
        // eslint-disable-next-line no-await-in-loop
        const category = await categoryModel.findOne({ slug }).exec();

        if (category === null) {
          logger.warn(
            `a categoria "${slug}" nao existe: o cartaz "${planned.label}" leva a uma pagina vazia.`,
          );
        }
      } else if (planned.link.startsWith(BRAND_PREFIX)) {
        const brand = decodeURIComponent(planned.link.slice(BRAND_PREFIX.length));
        // eslint-disable-next-line no-await-in-loop
        const quantos = await productModel.countDocuments({ brand }).exec();

        if (quantos === 0) {
          logger.warn(
            `nenhum produto com a marca "${brand}": o cartaz "${planned.label}" leva a uma vitrine vazia ate alguem escrever a marca no cadastro.`,
          );
        } else {
          logger.log(`${planned.label}: ${String(quantos)} produtos com a marca "${brand}"`);
        }
      }

      planejados.push({
        _id: objectIdOf(idByLink.get(planned.link)),
        label: planned.label,
        image: publicId,
        link: planned.link,
        caption: planned.caption ?? '',
        order: index,
        isActive: true,
      });
    }

    /*
     * Um cartaz so nao e um par.
     *
     * A home desenha a faixa em duas colunas e some inteira com menos de
     * dois — gravar um cartaz solitario apagaria a faixa sem dizer por que.
     * Melhor nao gravar e explicar.
     */
    if (planejados.length < 2) {
      logger.warn(
        `so ${String(planejados.length)} cartaz(es) com arte: a faixa precisa de dois, e nada foi gravado.`,
      );

      return;
    }

    if (options.dryRun) {
      logger.log(`[dry-run] a faixa ficaria com ${String(planejados.length)} cartazes:`);

      for (const [index, planejado] of planejados.entries()) {
        logger.log(
          `[dry-run]   ${String(index + 1)}. ${String(planejado.label)} -> ${String(planejado.link)}`,
        );
      }

      return;
    }

    settings.set('posters', planejados);
    await settings.save();

    logger.log(`${String(enviadas)} artes enviadas, ${String(mantidas)} ja estavam la.`);
    logger.log(`faixa gravada com ${String(planejados.length)} cartazes.`);

    /*
     * A arte que saiu de cena sai tambem da conta.
     *
     * Como o endereco carrega a impressao digital, trocar a arte de um cartaz
     * sempre deixa a anterior para tras — sem nenhuma referencia no cadastro,
     * invisivel no painel e ocupando espaco para sempre. So entra aqui o que
     * este script acabou de substituir, e so depois de a faixa nova estar
     * gravada.
     */
    const emUso = new Set(planejados.map((poster) => String(poster.image)));
    const aposentadas = [...new Set(artesAntigas)].filter(
      (publicId) => publicId !== '' && !emUso.has(publicId),
    );

    for (const publicId of aposentadas) {
      // eslint-disable-next-line no-await-in-loop
      const removida = await cloudinary.destroy(publicId);

      logger.log(removida ? `arte antiga removida: ${publicId}` : `ja nao estava la: ${publicId}`);
    }
  });
}

await main();
