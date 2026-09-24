import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OrdersTable, SearchIcon } from '@/components/admin';
import { Button, Chip, EmptyState, Input, Pagination } from '@/components/ui';
import {
  ORDER_STATUS_OPTIONS,
  activeFilterCount,
  canSeePrices,
  orderFiltersToSearch,
  orderListParams,
  readOrderFilters,
  useAdminRole,
  useOrders,
  withFilter,
  type OrderFilters,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-orders-page.module.css';

/**
 * A lista de pedidos.
 *
 * ## A cena de uso
 *
 * A dona não abre esta tela para navegar por ela. Ela abre com uma pergunta
 * já formada, quase sempre uma destas duas:
 *
 * - "**cade o pedido de quem acabou de me mandar mensagem**" — e ela tem na
 *   mão o código colado da conversa ou os digitos do número que ligou;
 * - "**o que esta esperando resposta**" — que e o clique que vem do card da
 *   abertura do painel.
 *
 * Por isso a busca e o primeiro controle e ocupa a linha inteira, e por isso
 * o status e uma fileira de pílulas em vez de um `<select>`: o recorte mais
 * usado do painel precisa custar um toque, e não abrir-escolher-fechar.
 *
 * O período vem por último porque e o filtro de quem esta conferindo o mês,
 * e não de quem esta atendendo.
 *
 * ## O recorte mora no endereço
 *
 * Não em `useState`. `features/admin/order-filters.ts` explica as três
 * razões; a curta e que o card "Esperando contato" da abertura aponta para
 * `?status=PENDING_CONTACT`, e que a dona manda o link da lista para quem
 * ajuda no atendimento.
 *
 * ## O que o STAFF vê
 *
 * A lista inteira, sem a coluna de total. A forma de pagamento continua, que
 * e o que ele precisa para responder — "Cartão 6x" diz como o cliente vai
 * pagar, e não quanto a loja ganha.
 */

/** O tempo que a digitação precisa parar antes de virar consulta. */
const SEARCH_DELAY_MS = 300;

export default function AdminOrdersPage() {
  const role = useAdminRole();
  const [search, setSearch] = useSearchParams();
  const filters = readOrderFilters(search);

  usePageMeta({ title: 'Pedidos — Painel', description: 'Acesso restrito.' });

  const apply = (patch: Partial<OrderFilters>): void => {
    // `replace` no lugar de empilhar: quem digitou "ME-2609" não quer apertar
    // voltar sete vezes para sair da lista. A mudanca de página e a de status
    // também são substituições — o histórico guarda por onde a pessoa andou,
    // e não cada ajuste de recorte.
    setSearch(orderFiltersToSearch(withFilter(filters, patch)), { replace: true });
  };

  const clearFilters = (): void => {
    setSearch({}, { replace: true });
  };

  const { data, isPending, isFetching, isError, error } = useOrders(orderListParams(filters));

  const orders = data?.items ?? [];
  const activeCount = activeFilterCount(filters);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Pedidos</h1>

        <p className={styles.count} aria-live="polite">
          {summary(data?.totalItems, isPending, activeCount > 0)}
        </p>
      </header>

      <div className={styles.filters}>
        <SearchField
          value={filters.q}
          onSearch={(q) => {
            apply({ q });
          }}
        />

        {/*
          A fileira de status. "Todos" primeiro, e depois a ordem do ciclo de
          vida do pedido — que e a ordem em que a dona procura o próximo
          passo, e não a alfabetica.
        */}
        <fieldset className={styles.statuses}>
          <legend className="visually-hidden">Filtrar por status</legend>

          <Chip
            active={filters.status === ''}
            onClick={() => {
              apply({ status: '' });
            }}
          >
            Todos
          </Chip>

          {ORDER_STATUS_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              active={filters.status === option.value}
              onClick={() => {
                // Clicar no status que já esta valendo o desliga. E o gesto
                // que se espera de uma pílula, e evita a viagem até "Todos"
                // do outro lado da fileira.
                apply({ status: filters.status === option.value ? '' : option.value });
              }}
            >
              {option.label}
            </Chip>
          ))}
        </fieldset>

        <div className={styles.period}>
          <Input
            label="De"
            type="date"
            block
            value={filters.from}
            max={filters.to === '' ? undefined : filters.to}
            onChange={(event) => {
              apply({ from: event.target.value });
            }}
          />

          <Input
            label="Até"
            type="date"
            block
            value={filters.to}
            min={filters.from === '' ? undefined : filters.from}
            onChange={(event) => {
              apply({ to: event.target.value });
            }}
          />

          {activeCount > 0 ? (
            <Button type="button" variant="ghost" className={styles.clear} onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : (
        <>
          {/*
            O recuo de opacidade marca a lista velha enquanto a nova vem. A
            alternativa seria trocar por esqueleto a cada tecla digitada, e
            aí a tela pisca mais do que informa: o esqueleto e só para quando
            ainda não há nada o que mostrar.
          */}
          <div className={isFetching && !isPending ? styles.refreshing : undefined}>
            {!isPending && orders.length === 0 ? (
              <EmptyState
                as="h2"
                title={activeCount > 0 ? 'Nenhum pedido neste recorte' : 'Nenhum pedido ainda'}
                description={
                  activeCount > 0
                    ? 'Mude o status, o período ou o que esta na busca.'
                    : 'Os pedidos fechados pelo site aparecem aqui, do mais novo para o mais antigo.'
                }
                actions={
                  activeCount > 0 ? (
                    <Button type="button" variant="secondary" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <OrdersTable orders={orders} isLoading={isPending} showTotals={canSeePrices(role)} />
            )}
          </div>

          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={(page) => {
              apply({ page });
            }}
            label="Páginas de pedidos"
          />
        </>
      )}
    </div>
  );
}

/* ---- A busca ------------------------------------------------------------- */

/**
 * O campo de busca, que espera a digitação parar.
 *
 * Tem estado próprio porque o campo precisa responder a cada tecla enquanto
 * o **endereço** só muda depois da pausa: escrever na URL a cada letra
 * geraria uma consulta por caractere.
 *
 * O `useEffect` de sincronia existe para o caminho de volta — o botão
 * voltar, o "Limpar filtros", o link colado com `?q=` já preenchido. Sem
 * ele, o endereço mudaria e o campo continuaria com o texto antigo.
 */
function SearchField({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [typed, setTyped] = useState(value);
  const settled = useDebouncedValue(typed.trim(), SEARCH_DELAY_MS);

  useEffect(() => {
    setTyped(value);
  }, [value]);

  useEffect(() => {
    if (settled !== value) {
      onSearch(settled);
    }
    // `onSearch` e `value` mudam a cada render da página — a função fecha
    // sobre os filtros atuais. O que dispara a busca e o texto ter parado de
    // mudar, e só ele pertence a esta lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  return (
    <Input
      label="Buscar pedido"
      hideLabel
      block
      type="search"
      inputMode="search"
      autoComplete="off"
      placeholder="Código do pedido ou telefone"
      prefix={<SearchIcon />}
      value={typed}
      onChange={(event) => {
        setTyped(event.target.value);
      }}
    />
  );
}

/* ---- A linha de contagem -------------------------------------------------- */

/**
 * "47 pedidos", "3 pedidos neste recorte", "Carregando os pedidos".
 *
 * A palavra "neste recorte" só aparece com filtro valendo, e e ela que evita
 * a leitura errada mais cara desta tela: "3 pedidos" num filtro esquecido de
 * setembro parece a loja inteira.
 */
function summary(total: number | undefined, isPending: boolean, filtered: boolean): string {
  if (isPending || total === undefined) {
    return 'Carregando os pedidos';
  }

  const noun = total === 1 ? 'pedido' : 'pedidos';

  return filtered ? `${String(total)} ${noun} neste recorte` : `${String(total)} ${noun}`;
}
