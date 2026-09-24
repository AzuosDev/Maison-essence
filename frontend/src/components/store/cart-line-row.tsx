import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { QuantityStepper, Skeleton } from '@/components/ui';
import {
  MAX_LINE_QUANTITY,
  lineKey,
  useCart,
  type CartLine,
  type CartLineHint,
  type QuoteLine,
} from '@/features/cart';
import { imageProps } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { formatCents } from '@/lib/format';
import styles from './cart-line-row.module.css';

/**
 * Uma linha da sacola.
 *
 * A mesma na gaveta e na página, com um `compact` decidindo o tamanho da
 * foto e o empilhamento. São dois desenhos do mesmo objeto, e escrever duas
 * vezes significaria manter em dois lugares o teto de estoque, o "remover",
 * o estado indisponível e o que acontece quando a cotação ainda não chegou —
 * que e onde os erros moram.
 *
 * ## De onde vem cada coisa
 *
 * A **quantidade** sai da sacola: e o cliente quem a escolheu, e o campo tem
 * que obedece-lo no mesmo quadro do clique. Tudo o mais que esta escrito
 * aqui sai da **cotação** — nome, foto, preço, estoque e o motivo de a linha
 * ter saido. A dica em memória cobre o intervalo entre adicionar e a
 * primeira resposta do servidor, e cobre só nome, opção e foto: nunca preço.
 *
 * Enquanto não há nem cotação nem dica — o caso de quem recarregou a página
 * — a linha desenha esqueletos com a altura final, e não um espaço vazio que
 * empurra o resto para baixo quando a resposta chega.
 *
 * ## A linha que saiu
 *
 * Fundo de aviso, preço riscado e o motivo escrito por extenso, vindo do
 * servidor: "Este produto saiu do catálogo", "Restam apenas 2 unidades". Ela
 * continua na lista, e a permanência e o ponto — sumir com o item faria o
 * cliente procurar o que ele mesmo tinha escolhido. O que sai e o valor
 * dela, que vale zero no total, e o seletor de quantidade, que não teria o
 * que ajustar.
 */

export interface CartLineRowProps {
  line: CartLine;
  /** O que o servidor diz desta linha. `null` antes da primeira cotação. */
  quote: QuoteLine | null;
  /** O que se sabia ao adicionar. `null` depois de recarregar a página. */
  hint: CartLineHint | null;
  /** Na gaveta: foto menor, controles empilhados. */
  compact?: boolean;
}

/** O `sizes` da miniatura: ela nunca passa de 96px de lado. */
const THUMB_SIZES = '96px';

export function CartLineRow({ line, quote, hint, compact = false }: CartLineRowProps) {
  const setQuantity = useCart((state) => state.setQuantity);
  const removeLine = useCart((state) => state.removeLine);

  const name = quote?.productName ?? hint?.name ?? '';
  const slug = quote?.productSlug ?? hint?.slug ?? '';
  const variantLabel = quote?.variantLabel ?? hint?.variantLabel ?? '';
  const image = quote?.image ?? hint?.image ?? '';
  const unavailable = quote?.unavailable === true;

  const remove = (): void => {
    removeLine(line.productId, line.variantId);
  };

  return (
    <li className={cx(styles.row, compact && styles.compact, unavailable && styles.unavailable)}>
      <div className={styles.media}>
        {image === '' && name === '' ? (
          <Skeleton className={styles.thumbSkeleton} />
        ) : (
          <img
            {...imageProps(image, 'thumb', THUMB_SIZES)}
            alt=""
            className={styles.thumb}
            width={96}
            height={128}
            loading="lazy"
            decoding="async"
          />
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.heading}>
          {name === '' ? (
            <Skeleton variant="text" width="60%" />
          ) : (
            <p className={styles.name}>
              {/* Sem slug não há para onde ir: o produto saiu do catalogo, e
                  um link que responde 404 e pior que texto. */}
              {slug === '' ? (
                name
              ) : (
                <Link to={ROUTES.product(slug)} className={styles.nameLink}>
                  {name}
                </Link>
              )}
            </p>
          )}

          {variantLabel === '' ? null : <p className={styles.variant}>{variantLabel}</p>}
        </div>

        {unavailable ? (
          <p className={styles.reason}>{quote?.unavailableReason}</p>
        ) : (
          <StockNote quote={quote} />
        )}

        <div className={styles.controls}>
          {unavailable ? null : (
            <QuantityStepper
              value={line.quantity}
              max={maxFor(quote)}
              size="small"
              hideLabel
              label={`Quantidade de ${name === '' ? 'item da sacola' : name}`}
              onChange={(quantity) => {
                setQuantity(line.productId, line.variantId, quantity);
              }}
            />
          )}

          {/* O nome vai no `aria-label`, e nao num `<span>` escondido ao
              lado do texto: numa sacola de seis, seis botoes chamados so
              "Remover" nao dizem qual e qual para quem ouve a pagina. O
              rotulo explicito tambem evita que o nome acessivel dependa de
              como o navegador junta dois nos de texto vizinhos. */}
          <button
            type="button"
            className={styles.remove}
            onClick={remove}
            aria-label={name === '' ? 'Remover o item' : `Remover ${name}`}
          >
            Remover
          </button>
        </div>
      </div>

      <div className={styles.price}>
        <LineTotal quote={quote} unavailable={unavailable} />
      </div>
    </li>
  );
}

/**
 * O valor da linha, sempre o da cotação.
 *
 * Não há `unitPriceCents * quantity` em lugar nenhum desta tela. O
 * `lineTotalCents` já vem do servidor com o desconto por quantidade
 * aplicado — refazer a multiplicação aqui daria o número errado justamente
 * nos carrinhos que ganharam desconto, que são os maiores.
 */
function LineTotal({ quote, unavailable }: { quote: QuoteLine | null; unavailable: boolean }) {
  if (quote === null) {
    return <Skeleton variant="text" width="4.5rem" />;
  }

  if (unavailable) {
    return <p className={styles.outOfTotal}>Fora do total</p>;
  }

  return (
    <>
      <p className={cx(styles.lineTotal, 'tabular')}>{formatCents(quote.lineTotalCents)}</p>

      {quote.discountCents > 0 ? (
        <p className={styles.lineDiscount}>-{quote.discountPercent}% por quantidade</p>
      ) : null}

      {/* O preco unitario so aparece quando ha mais de uma unidade: com uma
          so, ele repetiria o numero de cima. */}
      {quote.quantity > 1 ? (
        <p className={cx(styles.unitPrice, 'tabular')}>{formatCents(quote.unitPriceCents)} cada</p>
      ) : null}
    </>
  );
}

/** "Última unidade": só com estoque contado, baixo, e vindo da cotação. */
function StockNote({ quote }: { quote: QuoteLine | null }) {
  if (quote === null || quote.allowBackorder || quote.availableStock > LOW_STOCK) {
    return null;
  }

  return (
    <p className={styles.stock}>
      {quote.availableStock === 1
        ? 'Última unidade'
        : `Restam ${String(quote.availableStock)} unidades`}
    </p>
  );
}

/** Daqui para baixo, a linha avisa que o estoque esta acabando. */
const LOW_STOCK = 3;

/**
 * Até quanto o seletor deixa subir.
 *
 * O estoque que a cotação acabou de informar, e não o que o card mostrava
 * quando o item entrou na sacola. Sob encomenda não tem teto de estoque —
 * vale o teto da linha, que e o mesmo que o servidor aceita.
 *
 * Sem cotação ainda, o teto e o máximo: prender o campo em 1 enquanto a
 * resposta não chega impediria o cliente de digitar a quantidade que ele já
 * sabe que quer.
 */
function maxFor(quote: QuoteLine | null): number {
  if (quote === null || quote.allowBackorder) {
    return MAX_LINE_QUANTITY;
  }

  return quote.availableStock;
}

/** A chave da linha, para a lista que a desenha. */
export function rowKey(line: CartLine): string {
  return lineKey(line.productId, line.variantId);
}
