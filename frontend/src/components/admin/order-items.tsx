import type { AdminOrderItem } from '@/features/admin';
import { imageProps } from '@/lib/cloudinary';
import { formatCents } from '@/lib/format';
import styles from './order-items.module.css';

/**
 * Os itens do pedido, como o painel os le.
 *
 * ## Por que nao e o mesmo componente da conta do cliente
 *
 * A lista da conta (`components/account/order-items`) mostra o comprovante
 * de quem comprou, e mostra sempre os valores — e o dinheiro da propria
 * pessoa. Esta aqui mostra o pedido para quem atende, e precisa saber
 * esconder preco: o STAFF ve o que foi pedido e para onde vai, sem a margem
 * da loja. Um componente so com uma bandeira acabaria importado dos dois
 * lados, e a separacao entre loja e painel deixaria de existir.
 *
 * ## Nenhum numero aqui e calculado
 *
 * `lineTotalCents` chega congelado do pedido. Multiplicar quantidade por
 * preco unitario economizaria um campo e daria um numero diferente do que a
 * cliente pagou, porque o desconto entra na linha. Um pedido que discorda do
 * que foi cobrado e pior do que um pedido sem detalhe.
 *
 * ## A foto e a do dia da compra
 *
 * O item guarda o `publicId` que valia na epoca. Se a dona trocou a foto do
 * produto desde entao, o pedido continua mostrando o frasco que a cliente
 * viu — e e sobre aquele frasco que a conversa no WhatsApp vai ser.
 */

export interface OrderItemsProps {
  items: readonly AdminOrderItem[];
  /** Desligado para o STAFF: ele ve o que foi pedido, nao o quanto. */
  showPrices?: boolean;
}

export function OrderItems({ items, showPrices = true }: OrderItemsProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={`${item.productId}:${item.variantId}`} className={styles.item}>
          <img
            {...imageProps(item.image, 'thumb', '56px')}
            alt=""
            width="56"
            height="56"
            loading="lazy"
            decoding="async"
            className={styles.image}
          />

          <div className={styles.body}>
            <p className={styles.name}>{item.productName}</p>

            {item.variantLabel === '' ? null : (
              <p className={styles.variant}>{item.variantLabel}</p>
            )}

            {/*
              A quantidade fica mesmo sem preco: e o numero que se confere ao
              separar a encomenda. Sem ela a linha deixaria de dizer quantas
              unidades sairam, que e a unica coisa que o STAFF precisa saber
              sobre o item.
            */}
            <p className={styles.quantity}>
              <span className="tabular">
                {showPrices
                  ? `${String(item.quantity)} x ${formatCents(item.unitPriceCents)}`
                  : `${String(item.quantity)} ${item.quantity === 1 ? 'unidade' : 'unidades'}`}
              </span>

              {showPrices && item.discountPercent > 0 ? (
                <span className={styles.discount}>-{item.discountPercent}%</span>
              ) : null}
            </p>
          </div>

          {showPrices ? <p className={styles.total}>{formatCents(item.lineTotalCents)}</p> : null}
        </li>
      ))}
    </ul>
  );
}
