import type { OrderItemView } from '@/features/checkout';
import { imageProps } from '@/lib/cloudinary';
import { formatCents } from '@/lib/format';
import styles from './order-items.module.css';

/**
 * Os itens do pedido, com os precos do dia em que ele fechou.
 *
 * ## Nenhum numero desta lista e calculado aqui
 *
 * `lineTotalCents` vem do pedido, congelado. A tentacao seria multiplicar
 * quantidade por preco unitario e economizar um campo — e seria errado: o
 * desconto por quantidade entra na linha, e a conta local daria um numero
 * diferente do que a pessoa pagou. Um comprovante que discorda do que foi
 * cobrado e pior do que nao ter comprovante.
 *
 * ## A foto e a do pedido, nao a do catalogo de hoje
 *
 * O item guarda o `publicId` que valia na epoca. Se a dona trocou a foto do
 * produto desde entao, o historico continua mostrando o frasco que a cliente
 * viu quando comprou. `loading="lazy"` porque um pedido de quinze itens nao
 * pode segurar a primeira pintura da tela.
 */
export function OrderItems({ items }: { items: readonly OrderItemView[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={`${item.productId}:${item.variantId}`} className={styles.item}>
          <img
            {...imageProps(item.image, 'thumb', '72px')}
            alt=""
            width="72"
            height="72"
            loading="lazy"
            decoding="async"
            className={styles.image}
          />

          <div className={styles.body}>
            <p className={styles.name}>{item.productName}</p>

            {item.variantLabel === '' ? null : (
              <p className={styles.variant}>{item.variantLabel}</p>
            )}

            <p className={styles.unit}>
              {item.quantity} x {formatCents(item.unitPriceCents)}
              {item.discountPercent > 0 ? (
                <span className={styles.discount}>-{item.discountPercent}%</span>
              ) : null}
            </p>
          </div>

          <p className={styles.total}>{formatCents(item.lineTotalCents)}</p>
        </li>
      ))}
    </ul>
  );
}
