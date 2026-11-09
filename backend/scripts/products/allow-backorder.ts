import 'reflect-metadata';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
// Do `dist/`, e nao do `src/`, pelo mesmo motivo dos outros scripts: o `tsx`
// roda este arquivo por esbuild, que nao emite `emitDecoratorMetadata`, e o
// `SeedModule` que o `runSeed` sobe tem provider que injeta por tipo.
import { Product } from '../../dist/schemas.js';
import { runSeed } from '../../dist/seeds/seed-runner.js';

/**
 * `npm run products:backorder`
 *
 * Liga a venda sob encomenda (`allowBackorder`) em **todas** as variantes de
 * **todos** os produtos do banco. Com ela ligada, estoque zerado deixa de
 * virar o selo "Esgotado" na vitrine: a loja continua vendendo e a dona
 * encomenda o frasco ao distribuidor depois do pedido.
 *
 * ```
 * npm run products:backorder -- --dry-run   # so diz o que faria
 * npm run products:backorder
 * ```
 *
 * ## Por que isto e um script, e nao um botao no painel
 *
 * O painel edita produto por produto, e o interruptor de encomenda vive na
 * linha da variante. Virar o catalogo inteiro por lá seria centenas de
 * cliques. Cadastro novo ja nasce com a encomenda ligada em todo caminho de
 * entrada — o formulario do painel, a importacao de catalogo e o padrao do
 * proprio schema —, entao este comando e a correcao de quem ficou atras: o
 * que entrou no banco antes dessa escolha.
 *
 * ## O que ele nao faz
 *
 * **Variante desativada continua fora da venda.** `isAvailable` e
 * `isActive && (stock > 0 || allowBackorder)`: desligar uma variante e uma
 * decisao de quem a desligou, e encomenda nenhuma reverte isso. O relatorio
 * conta quantas estao assim no fim, porque um produto com todas as variantes
 * desativadas continua esgotado na vitrine depois deste script — e quem rodou
 * o comando esperando o contrario precisa saber onde olhar.
 *
 * **Estoque nenhum e alterado.** O numero gravado continua o que estava: ele
 * e o que a dona tem em maos, e o painel segue mostrando o aviso de estoque
 * baixo de quem de fato tem frasco na prateleira.
 *
 * ## A volta
 *
 * Nao ha `--off`. Religar em massa seria apagar, sem possibilidade de
 * desfazer, a escolha de cada variante que foi desligada de proposito — e o
 * relatorio imprime nome e SKU de tudo que mudou justamente para que a volta,
 * se vier, seja feita olhando a lista.
 */
const dryRun = process.argv.slice(2).includes('--dry-run');

interface VariantRow {
  sku: string;
  label: string;
  stock: number;
  isActive: boolean;
  allowBackorder: boolean;
}

interface ProductRow {
  name: string;
  slug: string;
  variants: VariantRow[];
}

await runSeed('products:backorder', async (app, logger) => {
  const productModel = app.get<Model<Product>>(getModelToken(Product.name));

  const pending = await productModel
    .find(
      { 'variants.allowBackorder': false },
      {
        name: 1,
        slug: 1,
        'variants.sku': 1,
        'variants.label': 1,
        'variants.stock': 1,
        'variants.isActive': 1,
        'variants.allowBackorder': 1,
      },
    )
    .sort({ name: 1 })
    .lean<ProductRow[]>();

  const total = await productModel.countDocuments({});

  if (pending.length === 0) {
    logger.log(
      `Nada a fazer: as variantes dos ${String(total)} produtos ja vendem sob encomenda.`,
    );

    return;
  }

  let variantCount = 0;

  for (const product of pending) {
    const off = product.variants.filter((variant) => !variant.allowBackorder);

    variantCount += off.length;
    logger.log(
      `${product.name} (${product.slug}): ${off
        .map(
          (variant) =>
            `${variant.sku}${variant.label === '' ? '' : ` ${variant.label}`} · estoque ${String(variant.stock)}`,
        )
        .join(', ')}`,
    );
  }

  logger.log(
    `${String(variantCount)} variantes em ${String(pending.length)} dos ${String(total)} produtos passam a vender sob encomenda.`,
  );

  if (dryRun) {
    logger.log('--dry-run: nada foi gravado.');

    return;
  }

  // `$[]` pega toda variante do array: a que esta ligada ja esta no valor
  // final, e gravar `true` sobre `true` nao muda nada. Um `arrayFilters` com
  // `allowBackorder: false` daria o mesmo resultado com mais peca movel.
  const result = await productModel.updateMany(
    { 'variants.allowBackorder': false },
    { $set: { 'variants.$[].allowBackorder': true } },
  );

  logger.log(`${String(result.modifiedCount)} produtos gravados.`);

  const inactive = await productModel.countDocuments({
    'variants.isActive': false,
  });

  if (inactive > 0) {
    logger.warn(
      `${String(inactive)} produtos ainda tem variante desativada — essas continuam fora da venda, por escolha de quem as desligou.`,
    );
  }
});
