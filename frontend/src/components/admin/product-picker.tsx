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
 * escolhido agora, e qual outro produto o substitui.
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
  const [typed, setTyped] = useState('');
  const term = useDebouncedValue(typed.trim(), SEARCH_DELAY_MS);

  const chosen = useProduct(productId ?? '');
  const found = useProducts({
    q: term,
    status: publishedOnly ? 'active' : 'all',
    limit: RESULTS,
  });
  const results = found.data?.items ?? [];
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
            <Thumb product={chosen.data} />

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

      <Input
        label={copy.searchLabel}
        block
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Nome ou marca"
        prefix={<SearchIcon />}
        hint={copy.searchHint}
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
              <Thumb product={product} />

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
              {product.id === productId ? (
                <span className={styles.current}>{copy.current}</span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  aria-label={`Escolher ${product.name}`}
                  onClick={() => {
                    onChange(product.id);
                  }}
                >
                  Escolher
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
 * A capa do produto.
 *
 * `alt=""` de propósito: o nome esta na linha ao lado, e uma miniatura que
 * repete "Asad" faria o leitor de tela anunciar o mesmo nome duas vezes.
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
