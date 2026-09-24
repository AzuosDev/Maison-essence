import type { ComponentType, SVGProps } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '@/lib/cx';
import styles from './stat-card.module.css';

/**
 * Um número da abertura do painel.
 *
 * Quatro deles abrem a tela, e cada um responde uma pergunta que a dona faz
 * antes de começar o dia. A regra que os mantem úteis: **todo card leva a
 * algum lugar**. Um número que não se pode abrir e decoração — se há três
 * pedidos esperando contato, o clique precisa mostrar quais são.
 *
 * Por isso o card e um `<a>`, e não uma caixa com um número dentro: ele se
 * comporta como link, responde ao teclado como link e abre em outra aba com
 * o meio do mouse como link.
 *
 * ## O tom de alerta
 *
 * Reservado para o que pede ação hoje — pedidos parados esperando contato,
 * produto esgotado na vitrine. Não e enfeite: com tudo em dia, nenhum card
 * fica dourado, e a tela inteira diz "nada pendente" sem escrever isso.
 */

export interface StatCardProps {
  label: string;
  /** O número já formatado: `12`, `R$ 3.480,00`. */
  value: string;
  /** A linha embaixo: o que o número quer dizer, ou o que fazer com ele. */
  note?: string | undefined;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Pede atenção: dourado em vez de neutro. */
  alert?: boolean;
  isLoading?: boolean;
}

export function StatCard({
  label,
  value,
  note,
  to,
  icon: Icon,
  alert = false,
  isLoading = false,
}: StatCardProps) {
  return (
    <Link to={to} className={cx(styles.card, alert && styles.alert)}>
      <span className={styles.head}>
        <Icon className={styles.icon} />
        <span className={styles.label}>{label}</span>
      </span>

      {/* Enquanto carrega, um tracinho no lugar do número: um zero seria uma
          informação, e uma informação errada — "nenhum pedido hoje" e o tipo
          de coisa que muda o humor de quem abriu o painel. */}
      <strong className={cx(styles.value, 'tabular')}>
        {isLoading ? <span aria-hidden="true">—</span> : value}
      </strong>

      {note === undefined || note === '' ? null : <span className={styles.note}>{note}</span>}
    </Link>
  );
}
