import { ConfirmDialog, MissingRoute, RefreshIcon } from '@/components/admin';
import { Badge, Button, Skeleton, useToast } from '@/components/ui';
import {
  isMissingRoute,
  useCollections,
  useDemoSeed,
  useHealth,
  type DatabaseStatus,
} from '@/features/admin';
import { env } from '@/lib/env';
import { errorMessage } from '@/lib/http';
import { useState } from 'react';
import styles from './system-health-page.module.css';

/**
 * A saude do servidor.
 *
 * ## O que esta tela e para
 *
 * Responder, em cinco segundos, "a aplicacao esta de pe e falando com o
 * banco?". E a primeira pergunta de quem recebe uma mensagem dizendo que o
 * site nao abre — antes de olhar log, antes de abrir o painel da hospedagem.
 *
 * Por isso o estado do banco tem o mesmo peso visual que o estado geral: com
 * `bufferCommands` desligado, um banco desconectado significa que **toda**
 * consulta desta requisicao falharia. Nao ha meio termo entre "conectado" e
 * "fora do ar", e a tela nao inventa um.
 *
 * ## O health check e publico
 *
 * De proposito: um monitor externo precisa alcanca-lo sem credencial. E a
 * unica chamada desta tela que funciona hoje — a contagem por colecao e o
 * seed pedem rotas que ainda nao existem.
 *
 * ## O seed so aparece em desenvolvimento
 *
 * `import.meta.env.DEV` vira `false` literal no build de producao, e o botao
 * some junto com o codigo dele. Isso e conveniencia, nao seguranca: a
 * garantia que vale e a do servidor recusando a rota fora de
 * desenvolvimento, porque quem chama a API direto nunca passou por este
 * arquivo.
 */
export default function SystemHealthPage() {
  const { toast } = useToast();
  const health = useHealth();
  const collections = useCollections();
  const seed = useDemoSeed();

  const [confirmSeed, setConfirmSeed] = useState(false);

  const runSeed = (): void => {
    seed.mutate(undefined, {
      onSuccess: () => {
        setConfirmSeed(false);
        toast({ title: 'Dados de demonstracao criados.', variant: 'success' });
      },
      onError: (failure) => {
        setConfirmSeed(false);
        toast({
          title: isMissingRoute(failure) ? 'O seed ainda nao tem rota na API' : 'O seed falhou',
          description: isMissingRoute(failure)
            ? 'Rode no terminal, dentro de backend/: npm run seed:demo'
            : errorMessage(failure),
          variant: 'danger',
          duration: 10_000,
        });
      },
    });
  };

  return (
    <div className={styles.page}>
      <section className={styles.block} aria-labelledby="health-status">
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle} id="health-status">
            Estado da aplicacao
          </h2>

          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={() => {
              void health.refetch();
            }}
            loading={health.isFetching && !health.isLoading}
          >
            <RefreshIcon />
            Conferir agora
          </Button>
        </div>

        {health.isLoading ? (
          <Skeleton height="10rem" />
        ) : health.isError ? (
          // Um health check que nao responde ja e a resposta: a aplicacao
          // nao esta atendendo. A tela diz isso, e nao "erro ao carregar".
          <div className={styles.down} role="alert">
            <p className={styles.downTitle}>A aplicacao nao respondeu</p>
            <p className={styles.downBody}>{errorMessage(health.error)}</p>
          </div>
        ) : (
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Aplicacao</dt>
              <dd>
                <Badge variant={health.data?.status === 'ok' ? 'success' : 'danger'}>
                  {health.data?.status === 'ok' ? 'no ar' : 'com problema'}
                </Badge>
              </dd>
            </div>

            <div className={styles.fact}>
              <dt>Banco de dados</dt>
              <dd>
                <Badge
                  variant={health.data?.database.status === 'connected' ? 'success' : 'danger'}
                >
                  {describeDatabase(health.data?.database.status)}
                </Badge>
              </dd>
            </div>

            <div className={styles.fact}>
              <dt>Versao</dt>
              <dd className={styles.mono}>{health.data?.version ?? '—'}</dd>
            </div>

            <div className={styles.fact}>
              <dt>No ar ha</dt>
              <dd>{formatUptime(health.data?.uptime ?? 0)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className={styles.block} aria-labelledby="collections">
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle} id="collections">
            Documentos por colecao
          </h2>
        </div>

        {collections.isLoading ? (
          <Skeleton height="8rem" />
        ) : collections.isError ? (
          isMissingRoute(collections.error) ? (
            <MissingRoute route="GET /admin/system/collections">
              Falta uma rota restrita ao administrador do sistema que devolva{' '}
              <code>{'[{ name, count }]'}</code> — um <code>estimatedDocumentCount()</code> por
              colecao registrada.
            </MissingRoute>
          ) : (
            <p className={styles.error} role="alert">
              {errorMessage(collections.error)}
            </p>
          )
        ) : (
          <ul className={styles.counts}>
            {(collections.data ?? []).map((collection) => (
              <li key={collection.name} className={styles.count}>
                <span className={styles.countName}>{collection.name}</span>
                <span className={styles.countValue}>
                  {collection.count.toLocaleString('pt-BR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {import.meta.env.DEV ? (
        <section className={styles.block} aria-labelledby="seed">
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle} id="seed">
              Dados de demonstracao
            </h2>
          </div>

          <div className={styles.seed}>
            <p className={styles.seedBody}>
              Popula a loja com categorias, produtos e pedidos de exemplo, para testar o painel com
              conteudo de verdade. So em desenvolvimento.
            </p>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setConfirmSeed(true);
              }}
            >
              Rodar o seed
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmSeed}
        onClose={() => {
          setConfirmSeed(false);
        }}
        onConfirm={runSeed}
        title="Rodar o seed de demonstracao?"
        description="Isso escreve no banco que este ambiente esta usando. Confira que e o de desenvolvimento antes de seguir."
        target={apiOrigin()}
        confirmLabel="Rodar o seed"
        loading={seed.isPending}
      />
    </div>
  );
}

/* ---- Apoio --------------------------------------------------------------- */

const DATABASE_LABELS: Record<DatabaseStatus, string> = {
  connected: 'conectado',
  connecting: 'conectando',
  disconnecting: 'desconectando',
  disconnected: 'fora do ar',
  uninitialized: 'nao iniciado',
};

function describeDatabase(status: DatabaseStatus | undefined): string {
  return status === undefined ? 'desconhecido' : DATABASE_LABELS[status];
}

/**
 * Quanto tempo o processo esta de pe.
 *
 * Em dias, horas e minutos — nao em segundos. O numero importa por uma razao
 * so: um uptime de dois minutos numa hora em que ninguem publicou nada
 * significa que a aplicacao caiu e voltou.
 */
export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) {
    return `${String(days)}d ${String(hours)}h`;
  }

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}min`;
  }

  // Abaixo de um minuto e o caso que mais importa: acabou de subir.
  return minutes > 0 ? `${String(minutes)}min` : `${String(total)}s`;
}

/**
 * O endereco da API, como alvo da confirmacao do seed.
 *
 * O alvo de uma acao destrutiva precisa ser o que sera atingido, e o que o
 * seed atinge e o banco daquele ambiente. O endereco da API e o nome mais
 * proximo disso que o navegador conhece.
 */
function apiOrigin(): string {
  return env.VITE_API_URL;
}
