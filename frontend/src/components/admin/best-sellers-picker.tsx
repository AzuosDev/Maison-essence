import { useState, type DragEvent } from 'react';
import { Badge, Skeleton } from '@/components/ui';
import { SETTINGS_LIMITS, moveItem, useProduct, type AdminProduct } from '@/features/admin';
import { cx } from '@/lib/cx';
import { ArrowDownIcon, ArrowUpIcon, GripIcon, TrashIcon } from './admin-icons';
import { ProductSearch, ProductThumb } from './product-picker';
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './best-sellers-picker.module.css';

/**
 * Quais produtos ocupam a fileira "Mais vendidos" da home.
 *
 * ## O que esta tela passou a decidir
 *
 * Até ela existir, a fileira era o ranking dos pedidos: quem a montava era a
 * cliente, comprando. A primeira fileira da home — a que mais vende —
 * mostrava o que esgotou, o que entrou num pedido grande de uma pessoa só, ou
 * o frasco barato que sai muito e não e o que a loja quer pôr na frente.
 * Aqui a dona aponta os produtos, e a ordem da lista e a ordem dos cards.
 *
 * ## A fileira e exatamente a escolha
 *
 * Quatro produtos escolhidos dao quatro cards, e nada entra atrás para
 * completar. E a diferença entre uma fileira curta de propósito e uma fileira
 * que a loja preencheu sozinha — e a dona precisa poder confiar em que o que
 * ela vê aqui e o que a cliente vê lá.
 *
 * ## A lista vazia não e tela quebrada
 *
 * Sem nenhuma escolha a fileira volta ao ranking das vendas, completado pelo
 * catálogo, que e o que ela sempre fez. O vazio desta tela diz isso em
 * palavras: e a única forma de a dona entender por que a home mostra uma
 * fileira que ela não montou.
 *
 * ## O produto fora do ar continua na lista
 *
 * E **não** aparece na loja — produto despublicado não entra em prateleira
 * nenhuma. A linha fica, com o selo vermelho e o aviso escrito, porque a
 * fileira encurta em silêncio e ninguém descobriria o motivo abrindo o site:
 * voltar o produto ao ar devolve o card ao lugar dele.
 */
export interface BestSellersPickerProps {
  /** Os ids escolhidos, na ordem da fileira. */
  productIds: readonly string[];
  onChange: (productIds: string[]) => void;
}

export function BestSellersPicker({ productIds, onChange }: BestSellersPickerProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const room = SETTINGS_LIMITS.bestSellers - productIds.length;

  const drop = (index: number): void => {
    if (dragging !== null) {
      onChange(moveItem(productIds, dragging, index));
    }

    setDragging(null);
    setOver(null);
  };

  return (
    <div className={styles.picker}>
      {productIds.length === 0 ? (
        <p className={styles.empty}>
          A fileira esta no automático: ela mostra o que mais vendeu, por unidades somadas nos
          pedidos, e completa as vagas que faltam com o catálogo. O primeiro produto escolhido aqui
          substitui esse critério inteiro.
        </p>
      ) : (
        <ol className={styles.list}>
          {productIds.map((productId, index) => (
            /*
              O detector avisa que um `<li>` não deveria ouvir eventos de
              ponteiro, e a preocupação e legitima: um alvo que só responde ao
              arraste não existe para quem usa teclado. Aqui ela esta
              atendida — "Subir" e "Descer" no menu da linha fazem o mesmo, e
              são o caminho principal, como no editor de atalhos.
            */
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={productId}
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
                productId={productId}
                index={index}
                total={productIds.length}
                onMove={(to) => {
                  onChange(moveItem(productIds, index, to));
                }}
                onRemove={() => {
                  onChange(productIds.filter((_unused, at) => at !== index));
                }}
              />
            </li>
          ))}
        </ol>
      )}

      <ProductSearch
        label="Adicionar produto a fileira"
        hint="Só produtos publicados aparecem na busca."
        publishedOnly
        chosenIds={productIds}
        currentLabel="na fileira"
        locked={room <= 0 ? 'fileira cheia' : ''}
        onPick={(productId) => {
          onChange([...productIds, productId]);
        }}
      />

      <p className={styles.room}>
        {room <= 0
          ? `A fileira esta cheia: ${String(SETTINGS_LIMITS.bestSellers)} cards e o que a home mostra. Remova um para trocar.`
          : 'O primeiro da lista e o primeiro card da home. Arraste para trocar a ordem, ou use Subir e Descer no menu da linha.'}
      </p>
    </div>
  );
}

/* ---- Uma linha escolhida --------------------------------------------------------- */

/**
 * O produto escolhido, buscado por id.
 *
 * Uma consulta por linha, como o perfume da vez faz com a dele: o rascunho
 * guarda só ids, e o nome e a foto saem do cadastro na hora — assim renomear
 * um produto não deixa esta tela mostrando o nome antigo. Doze consultas e o
 * teto, elas são as mesmas que a tela de produtos já guardou em cache, e isto
 * e o painel e não a vitrine.
 *
 * ## A posição esta escrita
 *
 * O número não e enfeite de lista: ele e a vaga do card na home, e e a
 * resposta da única pergunta que se faz ao arrastar — "qual vai ser o
 * primeiro?".
 */
function ChosenRow({
  productId,
  index,
  total,
  onMove,
  onRemove,
}: {
  productId: string;
  index: number;
  total: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const product = useProduct(productId);
  const name = product.data?.name ?? '';
  const away = product.data === undefined ? '' : whyAway(product.data);

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
      label: 'Tirar da fileira',
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

      {product.isPending ? (
        <>
          <Skeleton variant="image" width="3.5rem" height="3.5rem" />
          <Skeleton width="10rem" height="1rem" />
        </>
      ) : product.isError || product.data === undefined ? (
        <p className={styles.gone}>
          Este produto não esta mais no cadastro, e por isso não aparece na fileira. Tire-o da lista
          para a vaga voltar a ser de outro.
        </p>
      ) : (
        <>
          <ProductThumb product={product.data} />

          <div className={styles.identity}>
            <strong className={styles.name}>{product.data.name}</strong>

            {product.data.brand === '' ? null : (
              <span className={styles.brand}>{product.data.brand}</span>
            )}
          </div>

          {/*
            O selo e o aviso dizem a mesma coisa em dois alcances: o selo e o
            que se vê correndo a lista, a frase e o que explica a fileira
            curta. No celular só a frase sobrevive — o selo roubaria do nome
            do produto a largura de que ele precisa para ser lido.
          */}
          {away === '' ? null : (
            <span className={styles.flag}>
              <Badge variant="danger">
                {product.data.isActive ? 'não esta a venda' : 'fora do ar'}
              </Badge>
            </span>
          )}
        </>
      )}

      {/* O nome vira o rótulo do menu — `RowMenu` escreve "Ações de" na
          frente: doze menus numa lista são doze botões idênticos para quem
          navega por leitor de tela. Sem nome ainda, vale a vaga. */}
      <RowMenu label={name === '' ? `card ${String(index + 1)}` : name} items={actions} />

      {away === '' ? null : <p className={styles.warning}>{away}</p>}
    </div>
  );
}

/**
 * Por que este produto não vai aparecer na fileira.
 *
 * Duas razões, e a segunda e a que ninguem adivinha: o produto esta
 * publicado, aparece na busca aqui, e mesmo assim não entra em prateleira
 * nenhuma da loja porque não tem variante a venda — a última foi desativada
 * ou o cadastro nunca teve uma ativa. Sem esta frase a dona escolhe o
 * produto, a fileira fica sem o card dele e a tela parece ter ignorado a
 * escolha.
 */
function whyAway(product: AdminProduct): string {
  if (!product.isActive) {
    return 'Fora do ar: a fileira fica com um card a menos até ele voltar.';
  }

  if (!product.variants.some((variant) => variant.isActive)) {
    return 'Sem variante a venda: a loja não mostra este produto em prateleira nenhuma, e a fileira fica com um card a menos. Ative uma variante no cadastro dele.';
  }

  return '';
}
