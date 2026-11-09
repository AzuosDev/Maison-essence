import { useState } from 'react';
import { Badge, Button, Input, Skeleton } from '@/components/ui';
import { useProduct, useProducts, type AdminProduct } from '@/features/admin';
import { imageProps } from '@/lib/cloudinary';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { AlertIcon, SearchIcon } from './admin-icons';
import styles from './product-picker.module.css';

/**
 * Apontar um produto do cadastro, por busca.
 *
 * Duas telas fazem isto hoje — o perfume da vez da home e o brinde por valor
 * de compra — e as duas fazem a mesma pergunta de um jeito só: quem esta
 * escolhido agora, e qual outro produto o substitui. A terceira tela que
 * escolhe produto, a fileira de mais vendidos, escolhe uma lista e não um:
 * ela monta a própria anatomia e reusa daqui a busca (`ProductSearch`) e a
 * miniatura (`ProductThumb`), que são a parte que a dona aprende uma vez.
 *
 * ## Por que uma busca, e não uma lista
 *
 * Porque o catálogo tem mais de duzentos produtos. Um `<select>` com duzentas
 * opções e uma rolagem as cegas — e a dona chega aqui com o produto já em
 * mente, pelo nome. Digitar três letras e mais curto que procurar na lista.
 *
 * ## O escolhido fica na tela
 *
 * Em cima, com foto, nome e marca. A busca continua embaixo: trocar a escolha
 * e escolher outro, não apagar e começar de novo.
 *
 * ## As palavras vem de fora
 *
 * "Sem escolha" significa coisas diferentes em cada tela — na home devolve a
 * seção ao último destaque, no brinde tira a foto do balão. Por isso toda a
 * copy chega por `copy`, e não há texto de domínio escrito aqui dentro: um
 * componente que dissesse "a home mostra o último destaque" na tela do brinde
 * estaria mentindo com todas as letras.
 */

/** O tempo que a digitação precisa parar antes de virar consulta. */
const SEARCH_DELAY_MS = 300;

/** Quantos resultados a busca mostra. Mais que isso vira lista para rolar. */
const RESULTS = 6;

/**
 * As palavras desta tela.
 *
 * Todas obrigatórias menos o aviso de produto fora do ar: ele e a única que
 * depende do uso — para a home, um produto despublicado troca o que a seção
 * mostra; para o brinde, não muda nada, porque brinde não se vende.
 */
export interface ProductPickerCopy {
  /** O que vale quando não há produto escolhido. */
  unset: string;
  /** O que dizer quando o produto escolhido sumiu do cadastro. */
  gone: string;
  /** O botão que desfaz a escolha. */
  clear: string;
  searchLabel: string;
  searchHint: string;
  /** O rótulo da linha que já esta escolhida: "na home", "e o brinde". */
  current: string;
  /** O aviso quando o escolhido esta fora do ar. Vazio não desenha nada. */
  offAir?: string;
}

export interface ProductPickerProps {
  /** O id escolhido, ou `null`. */
  productId: string | null;
  onChange: (productId: string | null) => void;
  copy: ProductPickerCopy;
  /**
   * A busca mostra só o que esta publicado.
   *
   * Ligado para a home: produto fora do ar não desenha a seção, e oferecê-lo
   * seria oferecer uma escolha que não acontece. Desligado para o brinde, que
   * não se vende e por isso não precisa estar na vitrine.
   */
  publishedOnly?: boolean;
}

export function ProductPicker({
  productId,
  onChange,
  copy,
  publishedOnly = false,
}: ProductPickerProps) {
  const chosen = useProduct(productId ?? '');
  const offAir = copy.offAir ?? '';

  return (
    <div className={styles.picker}>
      {productId === null ? (
        <p className={styles.unset}>{copy.unset}</p>
      ) : chosen.isPending ? (
        <div className={styles.chosen} aria-busy="true">
          <Skeleton variant="image" width="3.5rem" height="3.5rem" />
          <Skeleton width="12rem" height="1rem" />
        </div>
      ) : chosen.isError || chosen.data === undefined ? (
        <div className={styles.chosen}>
          <p className={styles.gone}>{copy.gone}</p>

          <Clear label={copy.clear} onChange={onChange} />
        </div>
      ) : (
        <>
          <div className={styles.chosen}>
            <ProductThumb product={chosen.data} />

            <div className={styles.identity}>
              <strong className={styles.name}>{chosen.data.name}</strong>

              {chosen.data.brand === '' ? null : (
                <span className={styles.brand}>{chosen.data.brand}</span>
              )}
            </div>

            {chosen.data.isActive || offAir === '' ? null : (
              <Badge variant="danger">fora do ar</Badge>
            )}

            <Clear label={copy.clear} onChange={onChange} />
          </div>

          {chosen.data.isActive || offAir === '' ? null : (
            <p className={styles.warning}>
              <AlertIcon />
              {offAir}
            </p>
          )}
        </>
      )}

      <ProductSearch
        label={copy.searchLabel}
        hint={copy.searchHint}
        publishedOnly={publishedOnly}
        chosenIds={productId === null ? [] : [productId]}
        currentLabel={copy.current}
        onPick={onChange}
      />
    </div>
  );
}

/**
 * A busca que escolhe um produto do cadastro.
 *
 * Mora aqui e não dentro de `ProductPicker` porque duas telas a usam com
 * anatomias de escolha diferentes: o perfume da vez e o brinde escolhem **um**
 * produto, e a fileira de mais vendidos escolhe uma lista ordenada. O que não
 * muda e a busca em si — três letras, seis resultados, a linha com miniatura,
 * nome e marca —, e ela e a parte que a dona aprende uma vez e reusa nas três.
 *
 * `chosenIds` e o que já esta escolhido, em qualquer das telas: a linha
 * correspondente troca o botão pelo rótulo em vez de sumir da lista, porque
 * uma lista que muda de tamanho a cada escolha faz o dedo errar o alvo.
 */
export interface ProductSearchProps {
  label: string;
  hint: string;
  /** A busca mostra só o que esta publicado. Ver `ProductPickerProps`. */
  publishedOnly?: boolean;
  /** O que já esta escolhido: a linha mostra o rótulo e não o botão. */
  chosenIds: readonly string[];
  /** O rótulo da linha já escolhida: "na home", "e o brinde", "na fileira". */
  currentLabel: string;
  /**
   * Por que não se pode escolher mais nada agora — "fileira cheia", por
   * exemplo. Preenchido, as linhas não escolhidas trocam o botão por este
   * texto: a busca continua lendo, e o limite e dito no lugar onde ele
   * atrapalha, e não só num rodapé que ninguém relê. Vazio não desenha nada,
   * como o aviso de produto fora do ar.
   */
  locked?: string;
  onPick: (productId: string) => void;
}

export function ProductSearch({
  label,
  hint,
  publishedOnly = false,
  chosenIds,
  currentLabel,
  locked = '',
  onPick,
}: ProductSearchProps) {
  const [typed, setTyped] = useState('');
  const term = useDebouncedValue(typed.trim(), SEARCH_DELAY_MS);

  const found = useProducts({
    q: term,
    status: publishedOnly ? 'active' : 'all',
    limit: RESULTS,
  });
  const results = found.data?.items ?? [];

  return (
    <>
      <Input
        label={label}
        block
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Nome ou marca"
        prefix={<SearchIcon />}
        hint={hint}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
      />

      {term === '' ? null : found.isPending ? (
        <ul className={styles.results} aria-busy="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className={styles.result}>
              <Skeleton variant="image" width="3.5rem" height="3.5rem" />
              <Skeleton width="10rem" height="1rem" />
            </li>
          ))}
        </ul>
      ) : found.isError ? (
        <p className={styles.gone} role="alert">
          A busca não respondeu. Tente de novo em instantes.
        </p>
      ) : results.length === 0 ? (
        <p className={styles.gone}>
          {publishedOnly
            ? 'Nenhum produto publicado com esse nome.'
            : 'Nenhum produto com esse nome no cadastro.'}
        </p>
      ) : (
        <ul className={styles.results}>
          {results.map((product) => (
            <li key={product.id} className={styles.result}>
              <ProductThumb product={product} />

              <div className={styles.identity}>
                <strong className={styles.name}>{product.name}</strong>

                {product.brand === '' ? null : (
                  <span className={styles.brand}>{product.brand}</span>
                )}
              </div>

              {/*
                O nome do produto entra no `aria-label` do botão: seis botões
                "Escolher" na lista são seis botões idênticos para quem navega
                por leitor de tela. O rótulo visível abre o nome acessível,
                que e o que o comando de voz exige.
              */}
              {chosenIds.includes(product.id) ? (
                <span className={styles.current}>{currentLabel}</span>
              ) : locked === '' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  aria-label={`Escolher ${product.name}`}
                  onClick={() => {
                    onPick(product.id);
                  }}
                >
                  Escolher
                </Button>
              ) : (
                <span className={styles.locked}>{locked}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Clear({
  label,
  onChange,
}: {
  label: string;
  onChange: (productId: string | null) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="small"
      className={styles.clear}
      onClick={() => {
        onChange(null);
      }}
    >
      {label}
    </Button>
  );
}

/**
 * A capa do produto, do tamanho que a linha usa nas três telas.
 *
 * `alt=""` de propósito: o nome esta na linha ao lado, e uma miniatura que
 * repete "Asad" faria o leitor de tela anunciar o mesmo nome duas vezes.
 */
export function ProductThumb({ product }: { product: AdminProduct }) {
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
