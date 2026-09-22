import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Spinner } from '@/components/ui';
import { useDialog } from '@/components/ui/use-dialog';
import { MIN_SEARCH_LENGTH, useSearchSuggestions } from '@/features/catalog';
import { imageUrl } from '@/lib/cloudinary';
import { formatCentsRange } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { CloseIcon, SearchIcon } from './icons';
import { useRecentSearches } from './use-recent-searches';
import styles from './search-overlay.module.css';

/**
 * A busca em tela cheia.
 *
 * Tres comportamentos, e cada um resolve um problema diferente.
 *
 * **O atraso de 300ms** existe porque cada tecla seria uma ida ao servidor:
 * "perfume" sao sete consultas, seis delas ja obsoletas quando respondem. O
 * atraso e do campo, e nao da consulta — `useDebouncedValue` segura o termo,
 * e a consulta so ve o que sobrou depois que a digitacao parou.
 *
 * **O minimo de tres letras** existe porque `pe` casaria com meio catalogo.
 * Abaixo disso a consulta nem e disparada, e o painel mostra as buscas
 * recentes, que e o que ajuda quem abriu a lupa sem um termo em mente.
 *
 * **As buscas recentes** ficam so no `localStorage` deste navegador. Nao vao
 * para a API e nao se ligam a conta nenhuma.
 *
 * O foco e preso pelo mesmo `useDialog` do modal e da gaveta: abrir a busca
 * com o teclado e ficar preso atras dela seria pior do que nao ter atalho.
 */
interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

/** Quanto tempo o campo espera a digitacao parar. */
const DEBOUNCE_MS = 300;

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const { recent, remember, forget, clear } = useRecentSearches();

  const debounced = useDebouncedValue(term.trim(), DEBOUNCE_MS);
  const { data, isFetching } = useSearchSuggestions(debounced);

  const { ref, onOverlayClick } = useDialog<HTMLDivElement>({ open, onClose });

  // O campo volta a ficar vazio a cada abertura: a busca anterior ja virou
  // historico, e reabrir a lupa com o termo antigo obrigaria a apagar antes
  // de digitar.
  //
  // Ajustado durante o render, comparando com o estado anterior de `open`, e
  // nao num efeito — o efeito limparia o campo um quadro depois de a busca
  // ja ter aparecido com o texto velho.
  const [wasOpen, setWasOpen] = useState(open);

  if (wasOpen !== open) {
    setWasOpen(open);

    if (open) {
      setTerm('');
    }
  }

  if (!open) {
    return null;
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault();

    const trimmed = term.trim();

    if (trimmed.length < MIN_SEARCH_LENGTH) {
      return;
    }

    remember(trimmed);
    onClose();
    void navigate(ROUTES.searchFor(trimmed));
  };

  const pick = (chosen: string): void => {
    remember(chosen);
    onClose();
    void navigate(ROUTES.searchFor(chosen));
  };

  const suggestions = data?.items ?? [];
  const searching = debounced.length >= MIN_SEARCH_LENGTH;

  return createPortal(
    // O veu fecha no clique; o equivalente de teclado e o Escape, tratado
    // pelo `useDialog`. Ver a nota em `modal.tsx`.
    // oxlint-disable-next-line click-events-have-key-events, no-static-element-interactions
    <div className={styles.overlay} onClick={onOverlayClick}>
      <div
        ref={ref}
        // oxlint-disable-next-line prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-label="Buscar produtos"
        tabIndex={-1}
        className={styles.panel}
      >
        {/* `<search>` e o marco de busca da pagina — o mesmo papel que
            `role="search"` faria, com o elemento que o HTML ja tem para
            isso. Quem navega por marcos chega aqui direto. */}
        <search>
          <form className={styles.form} onSubmit={submit}>
            <SearchIcon className={styles.searchIcon} width="22" height="22" />

            <input
              type="search"
              // O foco entra aqui porque e o primeiro focavel do dialogo — e
              // quem abre a busca quer digitar, nao procurar onde clicar.
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
              }}
              placeholder="Buscar perfumes, marcas..."
              aria-label="O que voce procura?"
              autoComplete="off"
              className={styles.input}
            />

            <button
              type="button"
              onClick={onClose}
              className={styles.close}
              aria-label="Fechar busca"
            >
              <CloseIcon />
            </button>
          </form>
        </search>

        <div className={styles.results}>
          {!searching && recent.length > 0 ? (
            <>
              <p className={styles.sectionTitle}>
                Buscas recentes
                <button type="button" onClick={clear} className={styles.clear}>
                  Limpar
                </button>
              </p>

              <ul className={styles.list}>
                {recent.map((item) => (
                  <li key={item} className={styles.recentRow}>
                    <button
                      type="button"
                      onClick={() => {
                        pick(item);
                      }}
                      className={styles.recentTerm}
                    >
                      {item}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        forget(item);
                      }}
                      className={styles.forget}
                      aria-label={`Remover "${item}" das buscas recentes`}
                    >
                      <CloseIcon width="14" height="14" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {!searching && recent.length === 0 ? (
            <p className={styles.hint}>
              Digite ao menos {MIN_SEARCH_LENGTH} letras para ver sugestoes.
            </p>
          ) : null}

          {searching ? (
            <>
              {/* O anuncio da contagem e `polite`: quem usa leitor de tela
                  ouve quantos resultados chegaram ao parar de digitar, sem
                  ser interrompido a cada letra. */}
              <p className={styles.sectionTitle} aria-live="polite">
                {isFetching && suggestions.length === 0
                  ? 'Buscando...'
                  : `${data?.totalItems ?? 0} resultado${data?.totalItems === 1 ? '' : 's'}`}
              </p>

              {isFetching && suggestions.length === 0 ? <Spinner label="Buscando" /> : null}

              <ul className={styles.list}>
                {suggestions.map((product) => (
                  <li key={product.id}>
                    <Link
                      to={ROUTES.product(product.slug)}
                      className={styles.suggestion}
                      onClick={() => {
                        remember(debounced);
                        onClose();
                      }}
                    >
                      <img
                        src={imageUrl(product.coverImage, 'thumb')}
                        alt=""
                        loading="lazy"
                        className={styles.thumb}
                      />

                      <span className={styles.suggestionText}>
                        <span className={styles.suggestionName}>{product.name}</span>
                        <span className={styles.suggestionBrand}>{product.brand}</span>
                      </span>

                      <span className={styles.suggestionPrice}>
                        {formatCentsRange(product.priceRangeCents)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {!isFetching && suggestions.length === 0 ? (
                <p className={styles.hint}>Nenhum produto encontrado para “{debounced}”.</p>
              ) : null}

              {suggestions.length > 0 ? (
                <Link
                  to={ROUTES.searchFor(debounced)}
                  className={styles.seeAll}
                  onClick={() => {
                    remember(debounced);
                    onClose();
                  }}
                >
                  Ver todos os resultados
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
