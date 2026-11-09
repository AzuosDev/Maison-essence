import { useState, type DragEvent } from 'react';
import { Skeleton } from '@/components/ui';
import {
  SETTINGS_LIMITS,
  brandCollisions,
  moveItem,
  useBrands,
  type BrandCount,
} from '@/features/admin';
import { cx } from '@/lib/cx';
import { AlertIcon, ArrowDownIcon, ArrowUpIcon, GripIcon, PlusIcon, TrashIcon } from './admin-icons';
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './brands-picker.module.css';

/**
 * Quais marcas a faixa "Nossas marcas" escreve, e em que ordem.
 *
 * ## O que esta tela passou a decidir
 *
 * Até ela existir, a faixa era as marcas dos produtos que a própria home
 * tinha carregado, em ordem alfabética. Ninguém escolhia — e, como marca e
 * campo livre do cadastro do produto, a faixa publicava cada erro de
 * digitação como se fosse uma marca da casa: "Arabe" ao lado de "Arabic", a
 * mesma casa escrita de três jeitos.
 *
 * ## As marcas são escolhidas de uma lista, e nunca digitadas
 *
 * Marca não tem registro próprio neste sistema: ela e texto no produto. Um
 * campo onde se digita o nome aqui criaria uma quarta grafia — e uma faixa
 * que leva para uma vitrine vazia, porque o filtro `?marca=` casa a grafia
 * exata. Então a lista de onde se escolhe e o catálogo, com a contagem de
 * cada grafia ao lado: e a contagem que denuncia qual delas e o erro.
 *
 * ## O que esta tela não conserta
 *
 * Ela não corrige o cadastro. Tirar "Arabe" da faixa esconde o erro da home e
 * deixa os produtos daquela grafia fora da vitrine da marca certa — o conserto
 * e abrir esses produtos e escrever a marca igual. Por isso as grafias
 * parecidas aparecem aqui como aviso, com quantos produtos cada uma tem, e
 * não como algo que o botão desta tela resolve.
 */
export interface BrandsPickerProps {
  /** As marcas escolhidas, na ordem da faixa. */
  brands: readonly string[];
  onChange: (brands: string[]) => void;
}

export function BrandsPicker({ brands, onChange }: BrandsPickerProps) {
  const found = useBrands();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const room = SETTINGS_LIMITS.brands - brands.length;
  const catalogo = found.data ?? [];
  const chosen = new Set(brands);

  const drop = (index: number): void => {
    if (dragging !== null) {
      onChange(moveItem(brands, dragging, index));
    }

    setDragging(null);
    setOver(null);
  };

  return (
    <div className={styles.picker}>
      {brands.length === 0 ? (
        <p className={styles.empty}>
          A faixa esta no automático: a home escreve as marcas dos produtos que ela acabou de
          mostrar, em ordem alfabética — inclusive as grafias repetidas. A primeira marca escolhida
          aqui substitui esse critério inteiro.
        </p>
      ) : (
        <ol className={styles.list}>
          {brands.map((brand, index) => (
            /*
              O detector avisa que um `<li>` não deveria ouvir eventos de
              ponteiro, e a preocupação e legitima: um alvo que só responde ao
              arraste não existe para quem usa teclado. Aqui ela esta
              atendida — "Subir" e "Descer" no menu da linha fazem o mesmo, e
              são o caminho principal, como nas outras listas da tela.
            */
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={brand}
              className={cx(
                styles.item,
                dragging === index && styles.dragging,
                over === index && dragging !== index && styles.dropTarget,
              )}
              draggable
              onDragStart={() => {
                setDragging(index);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDragOver={(event: DragEvent) => {
                // Sem isto o navegador recusa o solte: `dragover` só libera o
                // alvo quando o padrão e cancelado.
                event.preventDefault();
                setOver(index);
              }}
              onDrop={(event: DragEvent) => {
                event.preventDefault();
                drop(index);
              }}
            >
              <ChosenRow
                brand={brand}
                count={catalogo.find((row) => row.name === brand)}
                loading={found.isPending}
                index={index}
                total={brands.length}
                onMove={(to) => {
                  onChange(moveItem(brands, index, to));
                }}
                onRemove={() => {
                  onChange(brands.filter((_unused, at) => at !== index));
                }}
              />
            </li>
          ))}
        </ol>
      )}

      <Collisions brands={catalogo} />

      <div className={styles.catalog}>
        <h3 className={styles.catalogTitle}>As marcas do cadastro</h3>

        {found.isPending ? (
          <div className={styles.loading} aria-busy="true">
            <Skeleton height="2rem" />
            <Skeleton height="2rem" />
          </div>
        ) : found.isError ? (
          <p className={styles.gone} role="alert">
            Não deu para ler as marcas do cadastro agora. A faixa continua como esta; tente de novo
            daqui a pouco.
          </p>
        ) : catalogo.length === 0 ? (
          <p className={styles.gone}>
            Nenhum produto tem marca escrita no cadastro. Enquanto for assim, a faixa não aparece
            na home — nem no automático.
          </p>
        ) : (
          <ul className={styles.options}>
            {catalogo.map((brand) => (
              <li key={brand.name}>
                <button
                  type="button"
                  className={styles.option}
                  disabled={chosen.has(brand.name) || room <= 0}
                  onClick={() => {
                    onChange([...brands, brand.name]);
                  }}
                >
                  <PlusIcon />
                  <span className={styles.optionName}>{brand.name}</span>
                  <span className={styles.optionCount}>
                    {chosen.has(brand.name) ? 'na faixa' : countLabel(brand)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className={styles.room}>
        {room <= 0
          ? `A faixa esta cheia: ${String(SETTINGS_LIMITS.brands)} nomes e o que cabe nela. Tire um para trocar.`
          : 'A primeira da lista e a primeira da faixa. Arraste para trocar a ordem, ou use Subir e Descer no menu da linha.'}
      </p>
    </div>
  );
}

/**
 * Quantos produtos tem essa grafia, e quantos a cliente ve.
 *
 * Os dois números só aparecem quando divergem: "4 produtos" e a leitura
 * normal, e "4 produtos, 1 na vitrine" e a informação de que a vitrine
 * daquela marca esta quase vazia — que e o que decide se ela merece a faixa.
 */
function countLabel(brand: BrandCount): string {
  const total = brand.products === 1 ? '1 produto' : `${String(brand.products)} produtos`;

  if (brand.live === brand.products) {
    return total;
  }

  return brand.live === 0 ? `${total}, nenhum no ar` : `${total}, ${String(brand.live)} no ar`;
}

/* ---- As grafias parecidas -------------------------------------------------------- */

/**
 * A mesma marca escrita de dois jeitos no cadastro.
 *
 * E o aviso central desta tela, e ele fala do catálogo inteiro — não só do
 * que foi escolhido para a faixa. Quem abre esta seção e quem esta olhando a
 * lista de marcas da loja; e aqui, e não no cadastro de um produto por vez,
 * que da para ver que "Isabele" e "Isabelle" convivem.
 *
 * Não bloqueia nada: duas marcas diferentes podem mesmo ter nomes parecidos.
 * Quem decide e quem conhece o estoque.
 */
function Collisions({ brands }: { brands: readonly BrandCount[] }) {
  const groups = brandCollisions(brands.map((brand) => brand.name));

  if (groups.length === 0) {
    return null;
  }

  const sizeOf = (name: string): number =>
    brands.find((brand) => brand.name === name)?.products ?? 0;

  return (
    <div className={styles.collisions}>
      <p className={styles.collisionsTitle}>
        <AlertIcon />
        {groups.length === 1
          ? 'Duas grafias parecem a mesma marca'
          : `${String(groups.length)} marcas aparecem escritas de mais de um jeito`}
      </p>

      <ul className={styles.collisionsList}>
        {groups.map((group) => (
          <li key={group.join('|')}>
            {group.map((name, index) => (
              <span key={name}>
                {index === 0 ? '' : ' · '}
                <strong>{name}</strong> ({String(sizeOf(name))})
              </span>
            ))}
          </li>
        ))}
      </ul>

      <p className={styles.collisionsHint}>
        Cada grafia e uma vitrine separada, com parte dos produtos em cada uma. O que conserta isso
        e abrir os produtos da grafia menor e escrever a marca igual a da maior — tirar o nome
        daqui só esconde o problema da home.
      </p>
    </div>
  );
}

/* ---- Uma linha escolhida --------------------------------------------------------- */

function ChosenRow({
  brand,
  count,
  loading,
  index,
  total,
  onMove,
  onRemove,
}: {
  brand: string;
  /** A grafia no catálogo. Ausente: nenhum produto tem esse nome escrito. */
  count: BrandCount | undefined;
  loading: boolean;
  index: number;
  total: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const actions: RowMenuItem[] = [
    {
      label: 'Subir',
      icon: ArrowUpIcon,
      disabled: index === 0,
      onSelect: () => {
        onMove(index - 1);
      },
    },
    {
      label: 'Descer',
      icon: ArrowDownIcon,
      disabled: index === total - 1,
      onSelect: () => {
        onMove(index + 1);
      },
    },
    {
      label: 'Tirar da faixa',
      icon: TrashIcon,
      tone: 'danger',
      separated: true,
      onSelect: onRemove,
    },
  ];

  return (
    <div className={styles.row}>
      <GripIcon className={styles.grip} aria-hidden="true" />

      <span className={styles.position} aria-hidden="true">
        {index + 1}
      </span>

      <span className={styles.name}>{brand}</span>

      {loading ? (
        <Skeleton width="5rem" height="1rem" />
      ) : count === undefined ? (
        /*
          A marca que ninguém tem escrita continua na lista, e não some.
          Sumir sozinha seria a tela desfazendo uma escolha da dona sem dizer;
          e o nome pode voltar a ter produto amanha, quando ela corrigir o
          cadastro — ou pode ser ela montando a faixa antes de cadastrar.
        */
        <span className={styles.missing}>
          nenhum produto com essa grafia — a vitrine abre vazia
        </span>
      ) : (
        <span className={cx(styles.count, count.live === 0 && styles.missing)}>
          {countLabel(count)}
        </span>
      )}

      <RowMenu label={brand} items={actions} />
    </div>
  );
}
