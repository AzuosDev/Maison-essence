import { Badge, EmptyState, Skeleton } from '@/components/ui';
import { ROLE_LABELS, type SystemUser } from '@/features/admin';
import { formatDateTime } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { UserActions } from './user-actions';
import styles from './users-table.module.css';

/**
 * A lista de usuários do painel: tabela no desktop, cards no celular.
 *
 * Duas árvores e uma só montada, pelo mesmo motivo escrito em
 * `orders-table.tsx`: a tabela que vira card por CSS continua sendo anunciada
 * como tabela, com células sem linha nem coluna, e os rótulos em `::before`
 * não são lidos.
 *
 * ## O último acesso responde a pergunta real
 *
 * A coluna não existe por completude. Ela responde "esta conta ainda e usada
 * por alguém?", que e a pergunta que leva a desativar uma conta esquecida —
 * e conta esquecida com senha valida e como um painel e invadido.
 *
 * Quem nunca entrou aparece como **"nunca entrou"** e não como um traço: e
 * um estado com significado próprio. Junto com o aviso de senha temporária,
 * ele diz que o cadastro foi criado e nunca usado, e que a senha entregue
 * talvez ainda esteja num bilhete.
 */

/** Acima disto, tabela. Abaixo, cards — o mesmo corte do resto do painel. */
const WIDE = '(min-width: 48rem)';

export interface UsersTableProps {
  users: readonly SystemUser[];
  isLoading?: boolean;
  /** O id de quem esta logado: a própria linha não oferece "desativar". */
  currentUserId?: string | undefined;
  onEdit: (user: SystemUser) => void;
  onResetPassword: (user: SystemUser) => void;
  onRevokeSessions: (user: SystemUser) => void;
  onToggleStatus: (user: SystemUser) => void;
}

export function UsersTable(props: UsersTableProps) {
  const isWide = useMediaQuery(WIDE);

  if (props.isLoading === true) {
    return <UsersSkeleton wide={isWide} />;
  }

  if (props.users.length === 0) {
    return (
      <EmptyState
        as="h3"
        title="Nenhum usuário encontrado"
        description="Nenhuma conta casa com o que esta filtrado. Limpe a busca para ver todas."
      />
    );
  }

  return isWide ? <UserRows {...props} /> : <UserCards {...props} />;
}

/* ---- Pedaços compartilhados --------------------------------------------- */

function StatusBadge({ user }: { user: SystemUser }) {
  if (!user.isActive) {
    return <Badge variant="danger">Desativado</Badge>;
  }

  // Senha temporária pendente e um terceiro estado, e não um detalhe do
  // "ativo": a conta existe, mas ninguém entrou nela ainda.
  if (user.mustChangePassword) {
    return <Badge variant="gold">Senha temporária</Badge>;
  }

  return <Badge variant="success">Ativo</Badge>;
}

function lastAccess(user: SystemUser): string {
  return user.lastLoginAt === null ? 'nunca entrou' : formatDateTime(user.lastLoginAt);
}

/* ---- Desktop ------------------------------------------------------------ */

function UserRows({
  users,
  currentUserId,
  onEdit,
  onResetPassword,
  onRevokeSessions,
  onToggleStatus,
}: UsersTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">E-mail</th>
            <th scope="col">Papel</th>
            <th scope="col">Status</th>
            <th scope="col">Último acesso</th>
            <th scope="col">
              <span className="visually-hidden">Ações</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <th scope="row" className={styles.name}>
                {user.name}
                {user.id === currentUserId ? <span className={styles.you}>você</span> : null}
              </th>

              <td className={styles.email}>{user.email}</td>

              <td>{ROLE_LABELS[user.role]}</td>

              <td>
                <StatusBadge user={user} />
              </td>

              <td className={styles.access}>{lastAccess(user)}</td>

              <td>
                <UserActions
                  userName={user.name}
                  isActive={user.isActive}
                  isSelf={user.id === currentUserId}
                  onEdit={() => {
                    onEdit(user);
                  }}
                  onResetPassword={() => {
                    onResetPassword(user);
                  }}
                  onRevokeSessions={() => {
                    onRevokeSessions(user);
                  }}
                  onToggleStatus={() => {
                    onToggleStatus(user);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Celular ------------------------------------------------------------ */

function UserCards({
  users,
  currentUserId,
  onEdit,
  onResetPassword,
  onRevokeSessions,
  onToggleStatus,
}: UsersTableProps) {
  return (
    <ul className={styles.cards}>
      {users.map((user) => (
        <li key={user.id} className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardWho}>
              <p className={styles.cardName}>
                {user.name}
                {user.id === currentUserId ? <span className={styles.you}>você</span> : null}
              </p>

              <p className={styles.cardEmail}>{user.email}</p>
            </div>

            <UserActions
              userName={user.name}
              isActive={user.isActive}
              isSelf={user.id === currentUserId}
              onEdit={() => {
                onEdit(user);
              }}
              onResetPassword={() => {
                onResetPassword(user);
              }}
              onRevokeSessions={() => {
                onRevokeSessions(user);
              }}
              onToggleStatus={() => {
                onToggleStatus(user);
              }}
            />
          </div>

          <dl className={styles.cardFacts}>
            <div>
              <dt>Papel</dt>
              <dd>{ROLE_LABELS[user.role]}</dd>
            </div>

            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge user={user} />
              </dd>
            </div>

            <div className={styles.cardWide}>
              <dt>Último acesso</dt>
              <dd>{lastAccess(user)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/* ---- Carregando --------------------------------------------------------- */

function UsersSkeleton({ wide }: { wide: boolean }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} height={wide ? '3.25rem' : '9rem'} />
      ))}
    </div>
  );
}
