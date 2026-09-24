import { useMemo, useState } from 'react';
import { HistoryIcon, MissingRoute, RefreshIcon } from '@/components/admin';
import { Badge, Button, EmptyState, Input, Pagination, Select, Skeleton } from '@/components/ui';
import {
  AUDIT_ACTION_OPTIONS,
  ROLE_LABELS,
  describeAction,
  diffOf,
  isMissingRoute,
  isSensitive,
  useAudit,
  useUsers,
  type AuditEntry,
  type AuditListParams,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { dayEndISO, dayStartISO, formatDateTime } from '@/lib/format';
import styles from './system-audit-page.module.css';

/**
 * A trilha de auditoria.
 *
 * ## A pergunta que esta tela responde
 *
 * Não e "o que aconteceu hoje" — para isso existe a abertura do painel. E
 * "**quem** mudou isso, e **quando**": o preço que ninguém lembra de ter
 * alterado, a chave PIX que mudou de conta, o pedido que voltou de status,
 * o login recusado as três da manha.
 *
 * Por isso os três filtros são pessoa, ação e período, e não uma busca por
 * texto. E por isso cada linha mostra o diff aberto, e não atrás de um
 * clique: quem abre a auditoria esta comparando várias linhas entre si, e
 * um acordeão obrigaria a abrir todas para depois ler.
 *
 * ## A trilha não esconde nada aqui
 *
 * Senha, token e hash são apagados no servidor, antes de gravar — chegam
 * como `[redigido]`. A chave PIX chega mascarada da origem, com os quatro
 * últimos caracteres visíveis de propósito: o valor apagado diria apenas que
 * algo mudou, e os quatro digitos dizem para qual conta a loja passou a
 * receber, que e a pergunta que a trilha existe para responder.
 *
 * ## A rota ainda não existe
 *
 * `GET /audit` não esta publicado. O módulo de auditoria tem serviço,
 * coleção e dois anos de retenção — só não tem controlador. Esta tela esta
 * inteira do lado de ca e mostra um aviso que nomeia a rota que falta
 * enquanto ela não responder.
 */

/** Trinta por página: cabe numa rolagem e não pesa a consulta. */
const PAGE_SIZE = 30;

export default function SystemAuditPage() {
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo<AuditListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(actorId === '' ? {} : { actorId }),
      ...(action === '' ? {} : { action }),
      ...(from === '' ? {} : { from: dayStartISO(from) }),
      // `to` inclusivo para quem preenche: escolher 30/09 nos dois campos
      // precisa trazer o dia 30 inteiro, e não zero resultados.
      ...(to === '' ? {} : { to: dayEndISO(to) }),
    }),
    [page, actorId, action, from, to],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useAudit(params);

  // A lista de pessoas sai da própria tela de usuários: o filtro por ator
  // precisa de nomes, e a trilha guarda só id e e-mail.
  const { data: users } = useUsers();

  const actorOptions = useMemo(
    () => (users ?? []).map((user) => ({ value: user.id, label: `${user.name} (${user.email})` })),
    [users],
  );

  /** Mexer em qualquer filtro volta para a primeira página. */
  const onFilter = (apply: () => void) => () => {
    apply();
    setPage(1);
  };

  const entries = data?.items ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.filters}>
        <Select
          label="Pessoa"
          block
          placeholder="Qualquer pessoa"
          options={actorOptions}
          value={actorId}
          onChange={(event) => {
            onFilter(() => {
              setActorId(event.target.value);
            })();
          }}
        />

        <Select
          label="Ação"
          block
          placeholder="Qualquer ação"
          options={AUDIT_ACTION_OPTIONS}
          value={action}
          onChange={(event) => {
            onFilter(() => {
              setAction(event.target.value);
            })();
          }}
        />

        <Input
          label="De"
          type="date"
          block
          value={from}
          onChange={(event) => {
            onFilter(() => {
              setFrom(event.target.value);
            })();
          }}
        />

        <Input
          label="Até"
          type="date"
          block
          value={to}
          onChange={(event) => {
            onFilter(() => {
              setTo(event.target.value);
            })();
          }}
        />

        <Button
          type="button"
          variant="secondary"
          className={styles.refresh}
          onClick={() => {
            void refetch();
          }}
          loading={isFetching && !isLoading}
        >
          <RefreshIcon />
          Recarregar
        </Button>
      </div>

      {isError ? (
        isMissingRoute(error) ? (
          <MissingRoute route="GET /audit">
            A trilha já e gravada: o módulo de auditoria tem coleção própria (
            <code>audit_entries</code>), dois anos de retenção e cinco serviços escrevendo nela.
            Falta o controlador que a devolva — uma página filtrada por <code>actorId</code>,{' '}
            <code>action</code>, <code>from</code> e <code>to</code>, no mesmo formato das outras
            listas do painel.
          </MissingRoute>
        ) : (
          <p className={styles.error} role="alert">
            {errorMessage(error)}
          </p>
        )
      ) : isLoading ? (
        <div className={styles.skeleton} aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} height="5.5rem" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          as="h2"
          title="Nada registrado neste recorte"
          description="Mude a pessoa, a ação ou o período. A trilha guarda dois anos."
        />
      ) : (
        <>
          <ul className={styles.list}>
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>

          {(data?.totalPages ?? 1) > 1 ? (
            <Pagination
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/* ---- Uma entrada --------------------------------------------------------- */

function AuditRow({ entry }: { entry: AuditEntry }) {
  const lines = diffOf(entry);

  return (
    <li className={styles.entry}>
      <div className={styles.entryHead}>
        <HistoryIcon className={styles.entryIcon} />

        <div className={styles.entryWhat}>
          <p className={styles.action}>
            {describeAction(entry.action)}
            {isSensitive(entry.action) ? <Badge variant="gold">atenção</Badge> : null}
          </p>

          <p className={styles.who}>
            {entry.actorEmail}
            {entry.actorRole === null ? null : (
              <span className={styles.role}>{ROLE_LABELS[entry.actorRole]}</span>
            )}
          </p>
        </div>

        <time className={styles.when} dateTime={entry.createdAt}>
          {formatDateTime(entry.createdAt)}
        </time>
      </div>

      {entry.targetLabel === '' ? null : (
        <p className={styles.target}>
          <span className={styles.targetLabel}>Sobre</span>
          {entry.targetLabel}
        </p>
      )}

      {lines.length === 0 ? null : (
        <dl className={styles.diff}>
          {lines.map((line) => (
            <div key={line.path} className={styles.diffLine}>
              <dt className={styles.field}>{line.label}</dt>

              <dd className={styles.values}>
                {line.from === undefined ? null : (
                  <>
                    <span className={styles.before}>{line.from}</span>
                    <span className={styles.arrow} aria-hidden="true">
                      &rarr;
                    </span>
                    <span className="visually-hidden">virou</span>
                  </>
                )}

                <span className={styles.after}>{line.to}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
