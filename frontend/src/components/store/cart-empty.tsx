import { ButtonLink } from '@/components/ui';
import { ROUTES } from '@/app/routes';
import { cx } from '@/lib/cx';
import styles from './cart-empty.module.css';

/**
 * A sacola sem nada dentro.
 *
 * Nunca e só "sua sacola esta vazia". O vazio da sacola tem uma causa
 * provável — a pessoa acabou de chegar, ou acabou de fechar um pedido — e
 * uma saída obvia, que e voltar a vitrine. O botão importa mais que o texto:
 * um vazio mudo perde a visita que um "ver os perfumes" recupera.
 *
 * ## A ilustração
 *
 * Desenhada aqui, em SVG, e não um ícone do conjunto da loja. Os ícones do
 * cabeçalho são de 20px e existem para caber ao lado de um rótulo; isto aqui
 * e a peça central de uma tela vazia e precisa de outro tamanho e de outro
 * peso de traço. O que ela mantem do sistema e a lingua: traço de 1.5, sem
 * preenchimento, e o dourado da marca como único acento.
 *
 * As alcas em dourado e o corpo em cinza-linha não são enfeite: e o que
 * impede a figura de virar uma mancha cinza no meio do creme do fundo. Vai
 * com `aria-hidden` porque o título abaixo dela já diz o que ela mostra.
 */
export function CartEmpty({
  title = 'Sua sacola esta vazia',
  description = 'Os perfumes que você escolher aparecem aqui — e ficam guardados mesmo se você fechar o navegador.',
  compact = false,
  onNavigate,
}: {
  title?: string;
  description?: string;
  /** Na gaveta: ilustração menor e menos respiro. */
  compact?: boolean;
  /** A gaveta se fecha ao seguir o link; a página não precisa de nada. */
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <div className={cx(styles.empty, compact && styles.compact)}>
      <EmptyBag className={styles.illustration} />

      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>

      <ButtonLink to={ROUTES.products} onClick={onNavigate}>
        Ver os perfumes
      </ButtonLink>
    </div>
  );
}

function EmptyBag({ className }: { className: string | undefined }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* O corpo da sacola, com o fundo levemente mais estreito que a boca —
          e o que a faz parecer papel dobrado, e não uma caixa. */}
      <path
        className={styles.bag}
        d="M13 21h38l-3.2 30.4A5 5 0 0 1 42.8 56H21.2a5 5 0 0 1-5-4.6L13 21Z"
      />

      {/* As alcas, no dourado da marca. */}
      <path className={styles.handles} d="M24 21v-6.5a8 8 0 0 1 16 0V21" />

      {/* A dobra da boca da sacola: uma linha só, que da profundidade sem
          pedir sombra nenhuma. */}
      <path className={styles.bag} d="M13 27h38" opacity="0.5" />
    </svg>
  );
}
