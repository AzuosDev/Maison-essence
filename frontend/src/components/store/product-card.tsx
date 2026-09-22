import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Badge, Button } from '@/components/ui';
import {
  compareAtCents,
  displayVariant,
  quantityDiscountLabel,
  soleVariant,
  type PublicProduct,
} from '@/features/catalog';
import { bestInterestFreeInstallment, usePaymentSettings } from '@/features/payments';
import { imageProps } from '@/lib/cloudinary';
import { formatCents, formatCentsRange, formatInstallment } from '@/lib/format';
import { cx } from '@/lib/cx';
import { useAddToCart } from './use-add-to-cart';
import { VariantPicker } from './variant-picker';
import styles from './product-card.module.css';

/**
 * O card de produto, usado em toda a loja.
 *
 * Home, vitrine, categoria, busca e relacionados desenham este componente e
 * nenhum outro. Ele recebe o `PublicProduct` como a API o entrega e nao busca
 * nada por conta propria — com uma excecao deliberada: as regras de
 * parcelamento, que sao uma consulta so para a visita inteira e que o
 * TanStack Query deduplica entre os vinte cards de uma grade.
 *
 * ## O botao
 *
 * Com **uma** variante, "Adicionar" poe o item na sacola e acabou. Com duas
 * ou mais, abre o seletor rapido — porque o card nao tem como saber se o
 * cliente quer os 50ml ou os 100ml, e adivinhar seria colocar o errado na
 * sacola. Produto esgotado mostra o botao desabilitado em vez de escondido:
 * o espaco continua ocupado e a grade nao muda de altura entre um card e o
 * vizinho.
 *
 * ## A foto
 *
 * Dois links levam ao produto — a foto e o nome —, mas so um entra na ordem
 * do Tab. A foto vai com `tabIndex={-1}` e `aria-hidden`, senao quem navega
 * por teclado pararia duas vezes em cada card para chegar ao mesmo lugar.
 */

/** O `sizes` da grade padrao: quatro colunas no desktop, duas no celular. */
const DEFAULT_SIZES = '(min-width: 64rem) 25vw, (min-width: 40rem) 33vw, 50vw';

export interface ProductCardProps {
  product: PublicProduct;
  /**
   * O card esta na primeira dobra.
   *
   * A foto carrega de imediato, sem `lazy`, e com prioridade alta. Vale para
   * os primeiros cards da primeira prateleira e para mais ninguem: prioridade
   * em tudo e prioridade em nada, e a imagem do hero perderia a corrida.
   */
  priority?: boolean;
  /** O `sizes` do `<img>`, quando a grade nao e a padrao. */
  sizes?: string;
  className?: string | undefined;
}

export function ProductCard({
  product,
  priority = false,
  sizes = DEFAULT_SIZES,
  className,
}: ProductCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addToCart = useAddToCart();

  const variant = displayVariant(product);
  const single = soleVariant(product);
  const compareAt = compareAtCents(product);
  const promo = quantityDiscountLabel(product);

  const { min, max } = product.priceRangeCents;
  const priceLabel = formatCentsRange(product.priceRangeCents);

  const add = () => {
    if (single) {
      addToCart(product, single);

      return;
    }

    setPickerOpen(true);
  };

  return (
    <article className={cx(styles.card, className)}>
      <Link
        to={ROUTES.product(product.slug)}
        className={styles.media}
        tabIndex={-1}
        aria-hidden="true"
      >
        <img
          {...imageProps(product.coverImage, 'card', sizes)}
          alt=""
          className={cx(styles.image, !product.inStock && styles.soldOut)}
          // A proporcao ja esta no CSS; as medidas aqui existem para o
          // navegador que ainda nao aplicou a folha de estilo.
          width={600}
          height={800}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />

        <div className={styles.badges}>
          {product.inStock ? null : <Badge variant="danger">Esgotado</Badge>}

          {product.discountPercent > 0 ? (
            <Badge variant="ink">-{product.discountPercent}%</Badge>
          ) : null}

          {product.isReadyToShip ? <Badge variant="success">Pronta entrega</Badge> : null}
        </div>
      </Link>

      <div className={styles.body}>
        <p className={styles.brand}>{product.brand}</p>

        <h3 className={cx(styles.nameRow, styles.name)}>
          <Link to={ROUTES.product(product.slug)} className={styles.nameLink}>
            {product.name}
          </Link>
        </h3>

        <p className={styles.prices}>
          {compareAt === null ? null : (
            <span className={`${styles.compareAt} tabular`}>
              {/* O leitor de tela nao ve o risco: sem isto, ele anuncia dois
                  precos seguidos e quem ouve nao sabe qual e qual. */}
              <span className="visually-hidden">De </span>
              {formatCents(compareAt)}
            </span>
          )}

          <span className={`${styles.price} tabular`}>
            {min === max ? null : <span className="visually-hidden">A partir de </span>}
            {priceLabel}
          </span>
        </p>

        <p className={styles.installment}>
          <InstallmentLine priceCents={min} />
        </p>

        <p className={styles.promo}>{promo}</p>

        <div className={styles.action}>
          <Button
            block
            variant={product.inStock ? 'primary' : 'secondary'}
            disabled={!product.inStock || variant === null}
            onClick={add}
          >
            {buttonLabel(product.inStock, single !== null)}
          </Button>
        </div>
      </div>

      {/* Montado so depois do primeiro clique: vinte modais fechados numa
          grade sao vinte arvores de DOM que ninguem pediu. */}
      {pickerOpen ? (
        <VariantPicker
          product={product}
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

function buttonLabel(inStock: boolean, isSingle: boolean): string {
  if (!inStock) {
    return 'Esgotado';
  }

  return isSingle ? 'Adicionar' : 'Escolher opcoes';
}

/**
 * "em ate 6x de R$ 41,58 sem juros", ou nada.
 *
 * Nada em tres casos: as regras ainda nao chegaram, a loja nao aceita cartao,
 * ou o preco e baixo demais para dividir sem furar a parcela minima. Nos tres
 * a linha fica vazia — e continua ocupando a altura dela, por causa do
 * `min-height` em `.installment`. E o que impede o botao de pular para baixo
 * quando `GET /payment-settings` responde depois do produto.
 */
function InstallmentLine({ priceCents }: { priceCents: number }) {
  const { data } = usePaymentSettings();
  const card = data?.card;

  if (!card) {
    return null;
  }

  const option = bestInterestFreeInstallment(priceCents, card);

  return option === null ? null : (
    <>
      em ate{' '}
      <span className="tabular">{formatInstallment(option.count, option.installmentCents)}</span>{' '}
      sem juros
    </>
  );
}
