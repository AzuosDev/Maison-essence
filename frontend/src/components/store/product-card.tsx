import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Badge, Button } from '@/components/ui';
import {
  compareAtCents,
  displayVariant,
  quantityDiscountLabel,
  soleVariant,
  usePrefetchProduct,
  type PublicProduct,
} from '@/features/catalog';
import { bestInterestFreeInstallment, usePaymentSettings } from '@/features/payments';
import { imageProps } from '@/lib/cloudinary';
import { formatCents, formatCentsRange, formatInstallment } from '@/lib/format';
import { cx } from '@/lib/cx';
import { Highlight } from './highlight';
import { useAddToCart } from './use-add-to-cart';
import { VariantPicker } from './variant-picker';
import styles from './product-card.module.css';

/**
 * O card de produto, usado em toda a loja.
 *
 * Home, vitrine, categoria, busca e relacionados desenham este componente e
 * nenhum outro. Ele recebe o `PublicProduct` como a API o entrega e não busca
 * nada por conta própria — com uma exceção deliberada: as regras de
 * parcelamento, que são uma consulta só para a visita inteira e que o
 * TanStack Query deduplica entre os vinte cards de uma grade.
 *
 * ## O botão
 *
 * Com **uma** variante, "Adicionar" põe o item na sacola e acabou. Com duas
 * ou mais, abre o seletor rápido — porque o card não tem como saber se o
 * cliente quer os 50ml ou os 100ml, e adivinhar seria colocar o errado na
 * sacola. Produto esgotado mostra o botão desabilitado em vez de escondido:
 * o espaço continua ocupado e a grade não muda de altura entre um card e o
 * vizinho.
 *
 * ## A foto
 *
 * Dois links levam ao produto — a foto e o nome —, mas só um entra na ordem
 * do Tab. A foto vai com `tabIndex={-1}` e `aria-hidden`, senão quem navega
 * por teclado pararia duas vezes em cada card para chegar ao mesmo lugar.
 */

/** O `sizes` da grade padrão: quatro colunas no desktop, duas no celular. */
const DEFAULT_SIZES = '(min-width: 64rem) 25vw, (min-width: 40rem) 33vw, 50vw';

export interface ProductCardProps {
  product: PublicProduct;
  /**
   * O card esta na primeira dobra.
   *
   * A foto carrega de imediato, sem `lazy`, e com prioridade alta. Vale para
   * os primeiros cards da primeira prateleira e para mais ninguém: prioridade
   * em tudo e prioridade em nada, e a imagem do hero perderia a corrida.
   */
  priority?: boolean;
  /** O `sizes` do `<img>`, quando a grade não e a padrão. */
  sizes?: string;
  /**
   * O termo buscado, realcado no nome.
   *
   * Só a página de busca passa isto. Vazio em todo o resto da loja, e o nome
   * sai limpo.
   */
  highlight?: string;
  className?: string | undefined;
}

export function ProductCard({
  product,
  priority = false,
  sizes = DEFAULT_SIZES,
  highlight = '',
  className,
}: ProductCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addToCart = useAddToCart();
  const prefetchProduct = usePrefetchProduct();

  const variant = displayVariant(product);
  const single = soleVariant(product);
  const compareAt = compareAtCents(product);
  const promo = quantityDiscountLabel(product);

  const { min, max } = product.priceRangeCents;
  const priceLabel = formatCentsRange(product.priceRangeCents);

  // A segunda foto do cadastro. `images[0]` e a capa, então a alternativa e a
  // seguinte — quando ela existe e não repete a capa.
  const hoverImage = product.images.find((image) => image !== product.coverImage);

  const add = () => {
    if (single) {
      addToCart(product, single);

      return;
    }

    setPickerOpen(true);
  };

  const prefetch = (): void => {
    prefetchProduct(product.slug);
  };

  return (
    <article className={cx(styles.card, className)}>
      {/* A prebusca fica nos dois links, e não no card inteiro: são eles que
          levam ao produto, e são eles que o cursor atravessa a caminho do
          clique. O `onFocus` do link do nome — o único do card que recebe
          foco — e o equivalente para quem navega por teclado. */}
      <Link
        to={ROUTES.product(product.slug)}
        className={styles.media}
        tabIndex={-1}
        aria-hidden="true"
        onMouseEnter={prefetch}
      >
        <img
          {...imageProps(product.coverImage, 'card', sizes)}
          alt=""
          className={cx(styles.image, !product.inStock && styles.soldOut)}
          // A proporção já esta no CSS; as medidas aqui existem para o
          // navegador que ainda não aplicou a folha de estilo.
          width={600}
          height={600}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />

        {/*
          A segunda foto, revelada quando o cursor entra no card.

          E a pergunta que quem compra perfume faz antes de clicar — como e o
          frasco de perto, vem na caixa — respondida sem tirar ninguém da
          vitrine. Só existe quando há uma segunda foto cadastrada: produto de
          foto única fica com o avanco lento da primeira e não pisca para ela
          mesma.

          `lazy` mesmo no card prioritário. Ela nunca e o maior elemento da
          primeira tela, e carrega-lá com prioridade tiraria banda justamente
          da foto que e.
        */}
        {hoverImage === undefined ? null : (
          <img
            {...imageProps(hoverImage, 'card', sizes)}
            alt=""
            className={cx(styles.imageHover, !product.inStock && styles.soldOut)}
            width={600}
            height={600}
            loading="lazy"
            decoding="async"
          />
        )}

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
          <Link
            to={ROUTES.product(product.slug)}
            className={styles.nameLink}
            onMouseEnter={prefetch}
            onFocus={prefetch}
          >
            <Highlight text={product.name} term={highlight} />
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

        {/*
          O botao e contornado, e nao preenchido.

          Numa fileira de cinco, cinco barras pretas cheias pesam mais que as
          cinco fotos e a vitrine passa a ser uma lista de botoes. Contornado,
          ele continua sendo claramente um botao — tem a altura e a pilula de
          todos os outros — e cede o primeiro lugar para o produto. Ao passar
          o mouse ele se enche de preto, que e quando a atencao de fato esta
          nele.

          Na pagina do produto o botao principal continua preenchido: la ele e
          a acao da tela, e nao um entre cinco.
        */}
        <div className={styles.action}>
          <Button
            block
            variant="secondary"
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

  // "Ver opções", e não "Escolher opções": o card tem 158px de largura no
  // celular, e o rótulo longo ou quebra em duas linhas ou empurra o card.
  return isSingle ? 'Adicionar' : 'Ver opções';
}

/**
 * "em até 6x de R$ 41,58 sem juros", ou nada.
 *
 * Nada em três casos: as regras ainda não chegaram, a loja não aceita cartão,
 * ou o preço e baixo demais para dividir sem furar a parcela mínima. Nos três
 * a linha fica vazia — e continua ocupando a altura dela, por causa do
 * `min-height` em `.installment`. E o que impede o botão de pular para baixo
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
      em até{' '}
      <span className="tabular">{formatInstallment(option.count, option.installmentCents)}</span>{' '}
      sem juros
    </>
  );
}
