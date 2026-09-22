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
import { formatDateTime } from '@/lib/format';
import styles from './system-audit-page.module.css';

/**
 * A trilha de auditoria.
 *
 * ## A pergunta que esta tela responde
 *
 * Nao e "o que aconteceu hoje" — para isso existe a abertura do painel. E
 * "**quem** mudou isso, e **quando**": o preco que ninguem lembra de ter
 * alterado, a chave PIX que mudou de conta, o pedido que voltou de status,
 * o login recusado as tres da manha.
 *
 * Por isso os tres filtros sao pessoa, acao e periodo, e nao uma busca por
 * texto. E por isso cada linha mostra o diff aberto, e nao atras de um
 * clique: quem abre a auditoria esta comparando varias linhas entre si, e
 * um acordeao obrigaria a abrir todas para depois ler.
 *
 * ## A trilha nao esconde nada aqui
 *
 * Senha, token e hash sao apagados no servidor, antes de gravar — chegam
 * como `[redigido]`. A chave PIX chega mascarada da origem, com os quatro
 * ultimos caracteres visiveis de proposito: o valor apagado diria apenas que
 * algo mudou, e os quatro digitos dizem para qual conta a loja passou a
 * receber, que e a pergunta que a trilha existe para responder.
 *
 * ## A rota ainda nao existe
 *
 * `GET /audit` nao esta publicado. O modulo de auditoria tem servico,
 * colecao e dois anos de retencao — so nao tem controlador. Esta tela esta
 * inteira do lado de ca e mostra um aviso que nomeia a rota que falta
 * enquanto ela nao responder.
 */

/** Trinta por pagina: cabe numa rolagem e nao pesa a consulta. */
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
      ...(from === '' ? {} : { from: startOfDay(from) }),
      // `to` inclusivo para quem preenche: escolher 30/09 nos dois campos
      // precisa trazer o dia 30 inteiro, e nao zero resultados.
      ...(to === '' ? {} : { to: endOfDay(to) }),
    }),
    [page, actorId, action, from, to],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useAudit(params);

  // A lista de pessoas sai da propria tela de usuarios: o filtro por ator
  // precisa de nomes, e a trilha guarda so id e e-mail.
  const { data: users } = useUsers();

  const actorOptions = useMemo(
    () => (users ?? []).map((user) => ({ value: user.id, label: `${user.name} (${user.email})` })),
    [users],
  );

  /** Mexer em qualquer filtro volta para a primeira pagina. */
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
          label="Acao"
          block
          placeholder="Qualquer acao"
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
          label="Ate"
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
            A trilha ja e gravada: o modulo de auditoria tem colecao propria (
            <code>audit_entries</code>), dois anos de retencao e cinco servicos escrevendo nela.
            Falta o controlador que a devolva — uma pagina filtrada por <code>actorId</code>,{' '}
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
          description="Mude a pessoa, a acao ou o periodo. A trilha guarda dois anos."
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
            {isSensitive(entry.action) ? <Badge variant="gold">atencao</Badge> : null}
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

/* ---- Datas --------------------------------------------------------------- */

/**
 * O comeco do dia escolhido, no fuso de quem esta olhando.
 *
 * `<input type="date">` devolve `2026-09-22`, que interpretado direto vira
 * meia-noite **UTC** — tres horas antes da meia-noite daqui. Sem esta
 * conversao, filtrar "de 22/09" perderia as acoes feitas entre 21h e meia-
 * noite do dia 21.
 */
function startOfDay(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

/** O fim do dia escolhido: "ate 30/09" inclui o dia 30 inteiro. */
function endOfDay(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}
