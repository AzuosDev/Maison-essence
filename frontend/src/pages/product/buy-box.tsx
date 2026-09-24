import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useAddToCart } from '@/components/store';
import { Badge, Button, QuantityStepper } from '@/components/ui';
import {
  isLowStock,
  linePricing,
  maxQuantityOf,
  type PublicProductDetail,
  type PublicVariant,
} from '@/features/catalog';
import { bestInterestFreeInstallment, usePaymentSettings } from '@/features/payments';
import { cx } from '@/lib/cx';
import { formatCents, formatInstallment } from '@/lib/format';
import { QuantityDiscounts } from './quantity-discounts';
import { VariantOptions } from './variant-options';
import styles from './buy-box.module.css';

/**
 * A coluna de compra: tudo o que decide o clique.
 *
 * Marca, nome, preço, opções, quantidade e os dois botões, nesta ordem —
 * que e a ordem em que a dúvida aparece. O cliente chega sabendo o que quer
 * ver (a foto), descobre quanto custa, escolhe o tamanho, decide quantos e
 * então compra.
 *
 * ## A avaliação
 *
 * Não há. O backend não tem resenha, nota nem contagem de avaliações — não
 * existe coleção, rota nem campo. O espaço esta reservado no layout (o
 * cabeçalho da coluna e um bloco próprio), e ligar a nota aqui será uma
 * linha no dia em que a API mandar uma. Inventar cinco estrelas no frontend
 * seria propaganda enganosa escrita em CSS.
 *
 * ## Os dois botões
 *
 * "Adicionar a sacola" continua a visita; "Comprar agora" põe o item na
 * sacola **e** vai para o checkout. O segundo não e um caminho paralelo: e o
 * mesmo caminho sem a parada, e por isso os dois passam exatamente pelo
 * mesmo `useAddToCart` — nenhuma linha de sacola nasce de outro lugar nesta
 * loja.
 *
 * ## A quantidade e a variante
 *
 * Trocar de opção volta a quantidade para um. O teto e o estoque da variante
 * escolhida, e manter "6" ao trocar para uma opção que tem duas unidades
 * deixaria a tela prometendo o que o checkout vai recusar. O ajuste acontece
 * no render, comparando com a variante já aplicada — por efeito, a tela
 * desenharia um quadro com o número errado antes de se corrigir.
 */

export interface BuyBoxProps {
  product: PublicProductDetail;
  /** A variante escolhida. `null` quando o produto ficou sem nenhuma ativa. */
  variant: PublicVariant | null;
  onSelectVariant: (variantId: string) => void;
}

export function BuyBox({ product, variant, onSelectVariant }: BuyBoxProps) {
  const addToCart = useAddToCart();
  const navigate = useNavigate();

  const max = maxQuantityOf(variant);
  const [quantity, setQuantity] = useState(1);

  // A variante em vigor, para detectar a troca sem efeito nenhum.
  const [applied, setApplied] = useState(variant?.id ?? '');

  if (applied !== (variant?.id ?? '')) {
    setApplied(variant?.id ?? '');
    setQuantity(1);
  }

  const unitPriceCents = variant?.priceCents ?? product.priceRangeCents.min;
  const pricing = linePricing(unitPriceCents, quantity, product.quantityDiscounts);
  const available = variant !== null && variant.isAvailable;

  const add = (): void => {
    if (variant === null) {
      return;
    }

    addToCart(product, variant, quantity);
  };

  const buyNow = (): void => {
    if (variant === null) {
      return;
    }

    addToCart(product, variant, quantity);
    void navigate(ROUTES.checkout);
  };

  return (
    <div className={styles.box}>
      <header className={styles.heading}>
        {product.brand === '' ? null : <p className={styles.brand}>{product.brand}</p>}

        <h1 className={styles.name}>{product.name}</h1>

        <div className={styles.flags}>
          {product.isReadyToShip ? <Badge variant="success">Pronta entrega</Badge> : null}
          {available ? null : <Badge variant="danger">Esgotado</Badge>}
        </div>
      </header>

      <PriceBlock
        product={product}
        variant={variant}
        quantity={quantity}
        totalCents={pricing.totalCents}
        savingsCents={pricing.savingsCents}
        percentOff={pricing.percentOff}
      />

      {product.variants.length > 1 ? (
        <VariantOptions
          variants={product.variants}
          selectedId={variant?.id ?? ''}
          name={`variant-${product.id}`}
          onSelect={onSelectVariant}
        />
      ) : null}

      <div className={styles.quantity}>
        <QuantityStepper value={quantity} max={max} onChange={setQuantity} />

        <StockNote variant={variant} />
      </div>

      <QuantityDiscounts
        ladder={product.quantityDiscounts}
        quantity={quantity}
        unitPriceCents={unitPriceCents}
        onChoose={(wanted) => {
          // O degrau pedido, até onde o estoque deixa: um "leve 6" com três
          // unidades em mãos vira três, e não uma promessa que a cotação
          // recusa.
          setQuantity(Math.min(wanted, Math.max(max, 1)));
        }}
      />

      <div className={styles.actions}>
        <Button block onClick={add} disabled={!available}>
          {available ? 'Adicionar a sacola' : 'Esgotado'}
        </Button>

        <Button block variant="secondary" onClick={buyNow} disabled={!available}>
          Comprar agora
        </Button>
      </div>
    </div>
  );
}

/* ---- O preço ------------------------------------------------------------ */

interface PriceBlockProps {
  product: PublicProductDetail;
  variant: PublicVariant | null;
  quantity: number;
  totalCents: number;
  savingsCents: number;
  percentOff: number;
}

/**
 * O preço, o riscado, o percentual, o parcelamento e o PIX.
 *
 * Com quantidade um — o caso de quase todo mundo — o número grande e o preço
 * da variante. Passando de um, ele vira o total do conjunto e a linha diz
 * quantas unidades são: um "R$ 189,90" sozinho ao lado de um seletor em 3
 * seria lido como o preço de três.
 */
function PriceBlock({
  product,
  variant,
  quantity,
  totalCents,
  savingsCents,
  percentOff,
}: PriceBlockProps) {
  const { data: payments } = usePaymentSettings();

  const compareAtCents = variant?.compareAtPriceCents ?? null;
  const discountPercent = variant?.discountPercent ?? product.discountPercent;
  const pix = payments?.pix;
  const card = payments?.card;

  // `card` e nulo quando a loja não aceita cartão e indefinido enquanto as
  // regras não chegaram: os dois casos são "não há parcelamento a anunciar".
  const installment = card ? bestInterestFreeInstallment(totalCents, card) : null;
  const pixDiscount =
    pix && pix.hasKey && pix.discountPercent > 0
      ? Math.round((totalCents * pix.discountPercent) / 100)
      : 0;

  return (
    <div className={styles.prices}>
      <p className={styles.priceRow}>
        {compareAtCents === null ? null : (
          <span className={cx(styles.compareAt, 'tabular')}>
            <span className="visually-hidden">De </span>
            {formatCents(compareAtCents * quantity)}
          </span>
        )}

        <span className={cx(styles.price, 'tabular')}>{formatCents(totalCents)}</span>

        {discountPercent > 0 ? <Badge variant="ink">-{discountPercent}%</Badge> : null}
      </p>

      {quantity > 1 ? (
        <p className={styles.unit}>
          {quantity} unidades
          {savingsCents > 0 ? ` · ${percentOff}% de desconto por quantidade` : ''}
        </p>
      ) : null}

      {installment === null ? null : (
        <p className={styles.installment}>
          ou em até{' '}
          <span className="tabular">
            {formatInstallment(installment.count, installment.installmentCents)}
          </span>{' '}
          sem juros
        </p>
      )}

      {/*
        Parcelamento com juros existe, mas as parcelas nao sao calculadas
        aqui: quem as devolve e a cotacao, com a tabela do servidor. Anunciar
        um numero proprio abriria a chance de a loja cobrar outro.
      */}
      {card && card.maxInstallments > card.interestFreeUpTo ? (
        <p className={styles.financed}>
          Em até {card.maxInstallments}x com juros. As parcelas aparecem no checkout.
        </p>
      ) : null}

      {pixDiscount > 0 && pix ? (
        <p className={styles.pix}>
          <strong className="tabular">{formatCents(totalCents - pixDiscount)}</strong> no PIX
          <span className={styles.pixOff}> ({pix.discountPercent}% de desconto)</span>
        </p>
      ) : null}
    </div>
  );
}

/* ---- O estoque ---------------------------------------------------------- */

/**
 * O aviso de estoque, quando há o que avisar.
 *
 * "Restam apenas 2" só aparece com estoque contado e baixo — a urgência
 * inventada e o truque mais gasto do comércio eletronico, e esta loja vende
 * para quem volta. Produto sob encomenda diz o que e, porque o prazo dele e
 * outro e o cliente precisa saber disso antes de comprar, não depois.
 *
 * O aviso sai num `<output>`, que e o elemento do resultado que muda sem que
 * a página mude — e já carrega o `role="status"` embutido. A troca de
 * variante anuncia o novo estoque a quem usa leitor de tela sem que nada
 * aqui precise pedir.
 */
function StockNote({ variant }: { variant: PublicVariant | null }) {
  if (variant === null) {
    return null;
  }

  if (variant.onDemand) {
    return <output className={styles.stock}>Sob encomenda. Combinamos o prazo pelo WhatsApp.</output>;
  }

  if (!isLowStock(variant)) {
    return null;
  }

  return (
    <output className={cx(styles.stock, styles.lowStock)}>
      {variant.stock === 1 ? 'Última unidade' : `Restam apenas ${String(variant.stock)} unidades`}
    </output>
  );
}
