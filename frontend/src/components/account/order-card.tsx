import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { WhatsappIcon } from '@/components/store';
import { Badge } from '@/components/ui';
import {
  conversationUrl,
  statusLabel,
  statusTone,
  type CustomerOrderSummary,
} from '@/features/account';
import { formatCents, formatDate, toDateTimeAttribute } from '@/lib/format';
import styles from './order-card.module.css';

export interface OrderCardProps {
  order: CustomerOrderSummary;
  /** O número da loja, das configurações. Vazio esconde o botão da conversa. */
  storeNumber: string;
}

/**
 * Um pedido na lista.
 *
 * ## O código e o título
 *
 * Não a data, não o valor. `ME-260922-4KP1` e o que a pessoa tem a mão — na
 * conversa com a loja, no comprovante que guardou — e e por ele que ela
 * reconhece qual dos três pedidos da tela e aquele sobre o qual esta
 * perguntando. Em `--font-mono`, que e o que permite ler caractere a
 * caractere e ditar por telefone sem confundir o zero.
 *
 * ## Um cartão, um link, e uma exceção
 *
 * O cartão inteiro leva ao detalhe: no celular, um alvo de toque do tamanho
 * do cartão e a diferença entre abrir o pedido e errar o dedo. Isso e feito
 * esticando o link do código por cima de tudo (`::after`), e não envolvendo
 * o cartão num `<a>` — um link dentro de outro link e HTML inválido, e o
 * botão do WhatsApp precisa ser alcancável por teclado como um destino
 * próprio.
 *
 * O botão do WhatsApp sobe acima dessa camada e continua clicável. E a única
 * exceção, e por isso ela funciona: duas escapatorias numa área esticada
 * viram uma roleta.
 *
 * ## O selo diz a palavra, não só a cor
 *
 * "A caminho" em tinta, "Entregue" em verde, "Cancelado" em vermelho. Quem
 * não distingue as cores lê a mesma coisa — e quem escolheu retirada lê
 * "Pronto para retirada" no lugar de "A caminho", porque e o mesmo status
 * significando outra coisa.
 */
export function OrderCard({ order, storeNumber }: OrderCardProps) {
  const conversation = conversationUrl(storeNumber, order.code);

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.code}>
          <Link to={ROUTES.account.order(order.code)} className={styles.link}>
            {order.code}
          </Link>
        </h3>

        <Badge variant={statusTone(order.status)}>{statusLabel(order.status, order.mode)}</Badge>
      </div>

      <p className={styles.meta}>
        <time dateTime={toDateTimeAttribute(order.createdAt)}>{formatDate(order.createdAt)}</time>
        <span aria-hidden="true">·</span>
        <span>
          {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'}
        </span>
      </p>

      <div className={styles.foot}>
        <p className={styles.total}>
          <span className={styles.totalLabel}>Total</span>
          {formatCents(order.totalCents)}
        </p>

        {conversation === '' ? null : (
          <a
            href={conversation}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.whatsapp}
          >
            <WhatsappIcon className={styles.whatsappIcon} />

            {/*
              O rótulo visível some no celular estreito, onde o icone verde já
              diz para onde vai. O nome acessível não some com ele — e escrito
              por extenso ao lado, com o código do pedido: numa lista de
              cartões parecidos, "Falar sobre este pedido" repetido quatro
              vezes não diz a quem ouve qual deles esta sob o cursor.
            */}
            <span className={styles.whatsappLabel} aria-hidden="true">
              Falar sobre este pedido
            </span>

            <span className="visually-hidden">
              Falar sobre o pedido {order.code} no WhatsApp, em uma nova aba
            </span>
          </a>
        )}
      </div>
    </article>
  );
}
