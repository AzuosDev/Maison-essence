import { useState } from 'react';
import { Badge, Button, Input, Skeleton } from '@/components/ui';
import { useProduct, useProducts, type AdminProduct } from '@/features/admin';
import { imageProps } from '@/lib/cloudinary';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { AlertIcon, SearchIcon } from './admin-icons';
import styles from './perfume-picker.module.css';

/**
 * Qual produto ocupa "O perfume da vez" na home.
 *
 * ## Por que uma busca, e não uma lista
 *
 * Porque o catálogo tem mais de duzentos produtos. Um `<select>` com duzentas
 * opções e uma rolagem as cegas — e a dona chega aqui com o perfume já em
 * mente, pelo nome. Digitar três letras e mais curto que procurar na lista.
 *
 * ## O escolhido fica na tela
 *
 * Em cima, com foto, nome e marca — e com o aviso de "fora do ar" quando ele
 * esta assim, porque esse e o caso em que a seção da home troca de produto
 * sem ninguém pedir. A busca continua embaixo: trocar o perfume da vez e
 * escolher outro, não apagar e começar de novo.
 *
 * ## A escolha vazia e um estado legitimo
 *
 * "Tirar a escolha" devolve a seção ao último produto marcado como destaque,
 * que e o padrão da loja. E dito com essas palavras, e não como "nenhum": a
 * seção continua na home de qualquer jeito.
 */

/** O tempo que a digitação precisa parar antes de virar consulta. */
const SEARCH_DELAY_MS = 300;

/** Quantos resultados a busca mostra. Mais que isso vira lista para rolar. */
const RESULTS = 6;

export interface PerfumePickerProps {
  /** O id escolhido, ou `null` para "vale o último destaque". */
  productId: string | null;
  onChange: (productId: string | null) => void;
}

export function PerfumePicker({ productId, onChange }: PerfumePickerProps) {
  const [typed, setTyped] = useState('');
  const term = useDebouncedValue(typed.trim(), SEARCH_DELAY_MS);

  const chosen = useProduct(productId ?? '');
  // Só o que esta publicado: produto fora do ar não desenha a seção na home,
  // e oferecê-lo aqui seria oferecer uma escolha que não acontece.
  const found = useProducts({ q: term, status: 'active', limit: RESULTS });
  const results = found.data?.items ?? [];

  return (
    <div className={styles.picker}>
      {productId === null ? (
        <p className={styles.unset}>
          Sem escolha: a home mostra o último produto marcado como destaque.
        </p>
      ) : chosen.isPending ? (
        <div className={styles.chosen} aria-busy="true">
          <Skeleton variant="image" width="3.5rem" height="3.5rem" />
          <Skeleton width="12rem" height="1rem" />
        </div>
      ) : chosen.isError || chosen.data === undefined ? (
        <div className={styles.chosen}>
          <p className={styles.gone}>
            O produto escolhido não esta mais no cadastro. Escolha outro, ou tire a escolha para a
            home voltar ao destaque.
          </p>

          <Clear onChange={onChange} />
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

            {chosen.data.isActive ? null : <Badge variant="danger">fora do ar</Badge>}

            <Clear onChange={onChange} />
          </div>

          {chosen.data.isActive ? null : (
            <p className={styles.warning}>
              <AlertIcon />
              Enquanto este produto estiver fora do ar, a home mostra o último destaque no lugar
              dele.
            </p>
          )}
        </>
      )}

      <Input
        label="Trocar por outro produto"
        block
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Nome ou marca"
        prefix={<SearchIcon />}
        hint="Só produtos publicados aparecem na busca."
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
        <p className={styles.gone}>Nenhum produto publicado com esse nome.</p>
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
                <span className={styles.current}>na home</span>
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

function Clear({ onChange }: { onChange: (productId: string | null) => void }) {
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
      Tirar a escolha
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
