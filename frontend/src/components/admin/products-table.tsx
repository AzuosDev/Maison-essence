import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Badge, Skeleton, Switch } from '@/components/ui';
import type { AdminProduct } from '@/features/admin';
import { imageProps } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { formatCentsRange } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { PencilIcon, StarIcon, TrashIcon, TruckIcon } from './admin-icons';
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './products-table.module.css';

/**
 * O catalogo: tabela no desktop, cards no celular.
 *
 * Duas arvores, e uma so e montada — pelo mesmo motivo da tabela de pedidos:
 * o truque de virar celula em bloco por CSS mantem a tabela anunciada como
 * tabela para quem usa leitor de tela, com celulas sem linha nem coluna, e o
 * rotulo de cada campo virando conteudo de CSS, que nao e lido.
 *
 * ## O interruptor esta na linha, e nao no menu
 *
 * Publicar e despublicar e a acao mais repetida desta tela, e a unica que a
 * dona faz em sequencia: ela desce a lista desativando o que acabou. Um
 * clique no interruptor resolve; tres cliques por linha — abrir o menu,
 * achar o item, confirmar — transformariam isso em uma tarefa.
 *
 * O interruptor vira no dedo (`useSetProductStatus` guarda o retrato e o
 * devolve se o servidor recusar), e por isso ele **nao** pede confirmacao:
 * despublicar nao apaga nada e se desfaz com o mesmo clique.
 *
 * ## O estoque em vermelho conta duas coisas
 *
 * Quantas unidades restam e que isso e pouco. A palavra continua escrita ao
 * lado — "esgotado" — para quem nao distingue a cor.
 */

/** Acima disto, tabela. Abaixo, cards — o corte que o painel usa inteiro. */
const WIDE = '(min-width: 48rem)';

/** Abaixo disto, a linha acende em vermelho. Igual ao aviso da abertura. */
const LOW_STOCK = 5;

export interface ProductsTableProps {
  products: readonly AdminProduct[];
  isLoading?: boolean;
  /** Nome da categoria por id, para a coluna. Ausente vira o id escondido. */
  categoryNames: ReadonlyMap<string, string>;
  /** Esconde a coluna de preco. O STAFF nao ve valor. */
  showPrices?: boolean;
  /** Desligado para o STAFF: ele le o catalogo, nao o edita. */
  canEdit?: boolean;
  onToggleStatus: (product: AdminProduct) => void;
  /**
   * Tira o produto da prateleira de pronta entrega.
   *
   * So a tela de pronta entrega o passa, e por isso ele e opcional: no
   * catalogo inteiro, "tirar da pronta entrega" seria uma acao para um
   * atributo que a linha nem sempre tem — e o lugar de liga-lo e o cadastro.
   */
  onToggleReadyToShip?: ((product: AdminProduct) => void) | undefined;
  /**
   * Exclui o cadastro.
   *
   * Opcional pela mesma razao que o de cima existe: na tela de pronta
   * entrega se confere prateleira, e apagar um cadastro inteiro por engano no
   * meio de uma conferencia e um estrago que nao se desfaz. Sem a funcao, o
   * item nem aparece no menu — um item que nao faz nada e pior do que a
   * ausencia dele.
   */
  onDelete?: ((product: AdminProduct) => void) | undefined;
}

export function ProductsTable({
  products,
  isLoading = false,
  categoryNames,
  showPrices = true,
  canEdit = true,
  onToggleStatus,
  onToggleReadyToShip,
  onDelete,
}: ProductsTableProps) {
  const isWide = useMediaQuery(WIDE);

  if (isLoading) {
    return <ProductsSkeleton wide={isWide} />;
  }

  const shared = {
    products,
    categoryNames,
    showPrices,
    canEdit,
    onToggleStatus,
    onToggleReadyToShip,
    onDelete,
  };

  return isWide ? <ProductRows {...shared} /> : <ProductCards {...shared} />;
}

type RowProps = Omit<ProductsTableProps, 'isLoading'> &
  Required<Pick<ProductsTableProps, 'showPrices' | 'canEdit'>>;

/* ---- Desktop ------------------------------------------------------------- */

function ProductRows({
  products,
  categoryNames,
  showPrices,
  canEdit,
  onToggleStatus,
  onToggleReadyToShip,
  onDelete,
}: RowProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Foto</span>
            </th>
            <th scope="col">Produto</th>
            <th scope="col">Categorias</th>
            {showPrices ? <th scope="col">Preco</th> : null}
            <th scope="col" className={styles.numeric}>
              Estoque
            </th>
            <th scope="col">Publicado</th>
            {canEdit ? (
              <th scope="col">
                <span className="visually-hidden">Acoes</span>
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td className={styles.thumbCell}>
                <Thumb product={product} />
              </td>

              <th scope="row" className={styles.nameCell}>
                <Link to={ROUTES.admin.product(product.id)} className={styles.nameLink}>
                  {product.name}
                </Link>

                <span className={styles.meta}>
                  {product.brand === '' ? null : <span>{product.brand}</span>}

                  {product.hasVariants ? <span>{product.variants.length} variantes</span> : null}

                  <Flags product={product} />
                </span>
              </th>

              <td className={styles.categories} title={categoryLabel(product, categoryNames)}>
                {categoryLabel(product, categoryNames)}
              </td>

              {showPrices ? (
                <td className={cx(styles.price, 'tabular')}>
                  {formatCentsRange(product.priceRangeCents)}
                </td>
              ) : null}

              <td className={cx(styles.numeric, 'tabular')}>
                <Stock product={product} />
              </td>

              <td>
                <Switch
                  label={`Publicar ${product.name}`}
                  hideLabel
                  checked={product.isActive}
                  disabled={!canEdit}
                  onChange={() => {
                    onToggleStatus(product);
                  }}
                />
              </td>

              {canEdit ? (
                <td className={styles.actionsCell}>
                  <RowMenu
                    label={product.name}
                    items={menuFor(product, onDelete, onToggleReadyToShip)}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Celular ------------------------------------------------------------- */

function ProductCards({
  products,
  categoryNames,
  showPrices,
  canEdit,
  onToggleStatus,
  onToggleReadyToShip,
  onDelete,
}: RowProps) {
  return (
    <ul className={styles.cards}>
      {products.map((product) => (
        <li key={product.id} className={styles.card}>
          <Thumb product={product} />

          <div className={styles.cardBody}>
            <Link to={ROUTES.admin.product(product.id)} className={styles.cardName}>
              {product.name}
            </Link>

            <span className={styles.meta}>
              {product.brand === '' ? null : <span>{product.brand}</span>}
              <Flags product={product} />
            </span>

            <p className={styles.cardCategories}>{categoryLabel(product, categoryNames)}</p>

            <p className={styles.cardFacts}>
              {showPrices ? (
                <span className="tabular">{formatCentsRange(product.priceRangeCents)}</span>
              ) : null}

              <Stock product={product} />
            </p>

            <Switch
              label="Publicado"
              checked={product.isActive}
              disabled={!canEdit}
              className={styles.cardSwitch}
              onChange={() => {
                onToggleStatus(product);
              }}
            />
          </div>

          {canEdit ? (
            <RowMenu label={product.name} items={menuFor(product, onDelete, onToggleReadyToShip)} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ---- Pedacos compartilhados ----------------------------------------------- */

/**
 * A capa do produto.
 *
 * `alt=""` de proposito: o nome do produto esta na linha ao lado, e uma
 * miniatura que repete "Asad" faria o leitor de tela anunciar o mesmo nome
 * duas vezes por linha, vinte vezes por pagina.
 */
function Thumb({ product }: { product: AdminProduct }) {
  return (
    <img
      {...imageProps(product.coverImage, 'thumb', '56px')}
      alt=""
      width="56"
      height="56"
      loading="lazy"
      decoding="async"
      className={styles.thumb}
    />
  );
}

/** Os selos de vitrine: destaque da home e pronta entrega. */
function Flags({ product }: { product: AdminProduct }) {
  return (
    <>
      {product.isFeatured ? (
        <span className={styles.flag}>
          <StarIcon className={styles.flagIcon} />
          Destaque
        </span>
      ) : null}

      {product.isReadyToShip ? (
        <span className={styles.flag}>
          <TruckIcon className={styles.flagIcon} />
          Pronta entrega
        </span>
      ) : null}
    </>
  );
}

function Stock({ product }: { product: AdminProduct }) {
  if (product.totalStock === 0) {
    return <Badge variant="danger">esgotado</Badge>;
  }

  return (
    <span className={product.totalStock <= LOW_STOCK ? styles.lowStock : undefined}>
      {product.totalStock}
    </span>
  );
}

/**
 * As categorias do produto, escritas.
 *
 * Um produto costuma estar em uma ou duas; tres ja e incomum. A lista inteira
 * cabe na celula e evita o "2 categorias" que obriga a abrir o cadastro para
 * saber quais. Sem nenhuma, a celula diz isso — e um cadastro incompleto, e a
 * vitrine nao mostra o produto em lugar nenhum a nao ser na busca.
 */
function categoryLabel(product: AdminProduct, categoryNames: ReadonlyMap<string, string>): string {
  const names = product.categoryIds
    .map((id) => categoryNames.get(id))
    .filter((name): name is string => name !== undefined);

  return names.length === 0 ? 'sem categoria' : names.join(', ');
}

function menuFor(
  product: AdminProduct,
  onDelete: ((product: AdminProduct) => void) | undefined,
  onToggleReadyToShip: ((product: AdminProduct) => void) | undefined,
): RowMenuItem[] {
  return [
    { label: 'Editar cadastro', icon: PencilIcon, to: ROUTES.admin.product(product.id) },
    ...(onToggleReadyToShip === undefined
      ? []
      : [
          {
            label: product.isReadyToShip ? 'Tirar da pronta entrega' : 'Por na pronta entrega',
            icon: TruckIcon,
            onSelect: () => {
              onToggleReadyToShip(product);
            },
          } satisfies RowMenuItem,
        ]),
    ...(onDelete === undefined
      ? []
      : [
          {
            label: 'Excluir produto',
            icon: TrashIcon,
            tone: 'danger',
            separated: true,
            onSelect: () => {
              onDelete(product);
            },
          } satisfies RowMenuItem,
        ]),
  ];
}

/* ---- Carregando ------------------------------------------------------------ */

function ProductsSkeleton({ wide }: { wide: boolean }) {
  const count = wide ? 6 : 3;

  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={wide ? '4.5rem' : '7rem'} />
      ))}
    </div>
  );
}
