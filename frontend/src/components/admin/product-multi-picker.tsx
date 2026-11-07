import { useState } from 'react';
import { Badge, Button, Input, Skeleton } from '@/components/ui';
import { useProduct, useProducts, type AdminProduct } from '@/features/admin';
import { imageProps } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { CheckIcon, CloseIcon, SearchIcon } from './admin-icons';
import styles from './product-multi-picker.module.css';

/**
 * Apontar vários produtos do cadastro, por busca.
 *
 * O irmão de `ProductPicker`, e a mesma anatomia de linha de propósito —
 * miniatura, nome com a marca embaixo, ação no fim. O que muda e a pergunta:
 * lá e "qual produto?", aqui e "quais, e quantos já escolhi?".
 *
 * ## Por que não e o `ProductPicker` com uma opção
 *
 * Porque a lista escolhida deixa de ser uma linha e passa a ser conteúdo: ela
 * cresce, rola, se conta e se desfaz item por item. Enfiar isso no componente
 * de uma escolha só o faria carregar dois layouts e duas copys que não se
 * parecem — e as duas telas que usam o outro hoje não ganhariam nada.
 *
 * ## O escolhido fica em cima, e a busca embaixo
 *
 * A lista do que já foi escolhido não sai da tela enquanto se procura o
 * próximo: o erro que ela evita e o mais comum, que e escolher duas vezes o
 * mesmo frasco numa campanha de doze. O item que já esta na lista aparece nos
 * resultados marcado como escolhido, e não desaparece deles — sumir faria a
 * busca por "Asad" voltar vazia e parecer quebrada.
 *
 * ## O teto e escrito antes de ser atingido
 *
 * A contagem "12 de 50" fica visível desde o primeiro item. Descobrir o limite
 * no quinquagésimo primeiro clique, por uma recusa do servidor, seria
 * descobri-lo da pior maneira.
 */

/** O tempo que a digitação precisa parar antes de virar consulta. */
const SEARCH_DELAY_MS = 300;

/** Quantos resultados a busca mostra. Mais que isso vira lista para rolar. */
const RESULTS = 8;

export interface ProductMultiPickerProps {
  /** Os ids escolhidos, na ordem em que foram escolhidos. */
  productIds: readonly string[];
  onChange: (productIds: string[]) => void;
  /** Quantos cabem. A tela recusa o excedente antes do servidor. */
  max: number;
  /** O que a lista vazia significa nesta tela. */
  emptyLabel: string;
  /** Erro de validação da lista inteira, se houver. */
  error?: string | undefined;
}

export function ProductMultiPicker({
  productIds,
  onChange,
  max,
  emptyLabel,
  error,
}: ProductMultiPickerProps) {
  const [typed, setTyped] = useState('');
  const term = useDebouncedValue(typed.trim(), SEARCH_DELAY_MS);

  const found = useProducts({ q: term, status: 'all', limit: RESULTS });
  const results = found.data?.items ?? [];

  const chosen = new Set(productIds);
  const full = productIds.length >= max;

  const add = (id: string): void => {
    if (!chosen.has(id) && !full) {
      onChange([...productIds, id]);
    }
  };

  const remove = (id: string): void => {
    onChange(productIds.filter((current) => current !== id));
  };

  return (
    <div className={styles.picker}>
      <div className={styles.count}>
        {productIds.length === 0 ? (
          <p className={styles.empty}>{emptyLabel}</p>
        ) : (
          <>
            <p className={cx(styles.tally, 'tabular')} aria-live="polite">
              {`${String(productIds.length)} de ${String(max)} produtos`}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="small"
              onClick={() => {
                onChange([]);
              }}
            >
              Tirar todos
            </Button>
          </>
        )}
      </div>

      {productIds.length === 0 ? null : (
        <ul className={styles.chosen}>
          {productIds.map((id) => (
            <ChosenRow key={id} productId={id} onRemove={remove} />
          ))}
        </ul>
      )}

      {error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Input
        label="Procurar produto"
        block
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Nome ou marca"
        prefix={<SearchIcon />}
        hint={
          full
            ? `A campanha já esta com ${String(max)} produtos, que e o limite. Tire um para pôr outro.`
            : 'Digite três letras do nome ou da marca. O produto entra na campanha ao ser escolhido.'
        }
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
        <p className={styles.error} role="alert">
          A busca não respondeu. Tente de novo em instantes.
        </p>
      ) : results.length === 0 ? (
        <p className={styles.empty}>Nenhum produto com esse nome no cadastro.</p>
      ) : (
        <ul className={styles.results}>
          {results.map((product) => (
            <li key={product.id} className={styles.result}>
              <Thumb product={product} />

              <Identity product={product} />

              {chosen.has(product.id) ? (
                <span className={styles.already}>
                  <CheckIcon />
                  na campanha
                </span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  disabled={full}
                  aria-label={`Pôr ${product.name} na campanha`}
                  onClick={() => {
                    add(product.id);
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

/**
 * Uma linha da lista escolhida.
 *
 * Busca o próprio produto pelo id, porque a lista que o cupom guarda são ids:
 * a campanha salva não carrega nome nem foto, e pedir os doze produtos de uma
 * vez exigiria uma rota que não existe. Doze consultas pequenas, todas
 * cacheadas pela chave do produto e compartilhadas com a busca da mesma tela.
 *
 * O produto que saiu do cadastro continua aparecendo, com o aviso: a lista do
 * cupom ainda tem o id dele, e a dona precisa poder tirá-lo.
 */
function ChosenRow({
  productId,
  onRemove,
}: {
  productId: string;
  onRemove: (id: string) => void;
}) {
  const product = useProduct(productId);

  return (
    <li className={styles.chosenRow}>
      {product.isPending ? (
        <>
          <Skeleton variant="image" width="3.5rem" height="3.5rem" />
          <Skeleton width="10rem" height="1rem" />
        </>
      ) : product.isError || product.data === undefined ? (
        <p className={styles.gone}>Produto fora do cadastro</p>
      ) : (
        <>
          <Thumb product={product.data} />

          <Identity product={product.data} />

          {product.data.isActive ? null : <Badge variant="danger">fora do ar</Badge>}
        </>
      )}

      <Button
        type="button"
        variant="ghost"
        size="small"
        className={styles.remove}
        aria-label={
          product.data === undefined
            ? 'Tirar este produto da campanha'
            : `Tirar ${product.data.name} da campanha`
        }
        onClick={() => {
          onRemove(productId);
        }}
      >
        <CloseIcon />
      </Button>
    </li>
  );
}

function Identity({ product }: { product: AdminProduct }) {
  return (
    <div className={styles.identity}>
      <strong className={styles.name}>{product.name}</strong>

      {product.brand === '' ? null : <span className={styles.brand}>{product.brand}</span>}
    </div>
  );
}

/** `alt=""` de propósito: o nome esta na linha ao lado. */
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
