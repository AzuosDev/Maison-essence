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
  /** O numero da loja, das configuracoes. Vazio esconde o botao da conversa. */
  storeNumber: string;
}

/**
 * Um pedido na lista.
 *
 * ## O codigo e o titulo
 *
 * Nao a data, nao o valor. `ME-260922-4KP1` e o que a pessoa tem a mao — na
 * conversa com a loja, no comprovante que guardou — e e por ele que ela
 * reconhece qual dos tres pedidos da tela e aquele sobre o qual esta
 * perguntando. Em `--font-mono`, que e o que permite ler caractere a
 * caractere e ditar por telefone sem confundir o zero.
 *
 * ## Um cartao, um link, e uma excecao
 *
 * O cartao inteiro leva ao detalhe: no celular, um alvo de toque do tamanho
 * do cartao e a diferenca entre abrir o pedido e errar o dedo. Isso e feito
 * esticando o link do codigo por cima de tudo (`::after`), e nao envolvendo
 * o cartao num `<a>` — um link dentro de outro link e HTML invalido, e o
 * botao do WhatsApp precisa ser alcancavel por teclado como um destino
 * proprio.
 *
 * O botao do WhatsApp sobe acima dessa camada e continua clicavel. E a unica
 * excecao, e por isso ela funciona: duas escapatorias numa area esticada
 * viram uma roleta.
 *
 * ## O selo diz a palavra, nao so a cor
 *
 * "A caminho" em tinta, "Entregue" em verde, "Cancelado" em vermelho. Quem
 * nao distingue as cores le a mesma coisa — e quem escolheu retirada le
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
              O rotulo visivel some no celular estreito, onde o icone verde ja
              diz para onde vai. O nome acessivel nao some com ele — e escrito
              por extenso ao lado, com o codigo do pedido: numa lista de
              cartoes parecidos, "Falar sobre este pedido" repetido quatro
              vezes nao diz a quem ouve qual deles esta sob o cursor.
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
