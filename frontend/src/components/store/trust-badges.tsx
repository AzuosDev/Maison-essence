import { cx } from '@/lib/cx';
import { CardIcon, ShieldIcon, TruckIcon } from './icons';
import styles from './trust-badges.module.css';

/**
 * Os três selos de confiança.
 *
 * Texto fixo, e não vindo da API: são afirmações sobre como a loja opera —
 * envia para o Brasil inteiro, o site e seguro, o cartão parcela — e não
 * configuração que a dona ajusta de um dia para o outro. Quando alguma delas
 * deixar de ser verdade, o certo e mudar aqui, com revisão, e não num campo
 * de texto do painel.
 */
const BADGES = [
  {
    icon: TruckIcon,
    title: 'Envio para todo o Brasil',
    note: 'Entrega com taxa fixa nas cidades atendidas.',
  },
  {
    icon: ShieldIcon,
    title: 'Site seguro',
    note: 'Seus dados trafegam protegidos, do início ao fim.',
  },
  {
    icon: CardIcon,
    title: 'Parcelamento no cartão',
    note: 'Combinado direto com a gente, pelo WhatsApp.',
  },
] as const;

/**
 * O tom, conforme o fundo em que a faixa cai.
 *
 * `dark` e o rodapé preto, que e onde os selos nasceram; `light` e a faixa da
 * home, sobre o creme. São as mesmas cores da paleta com os papéis trocados,
 * declaradas como variáveis no CSS Module — não há cor nova no sistema, e não
 * há um segundo componente de selos para manter em sincronia com este.
 */
interface TrustBadgesProps {
  tone?: 'dark' | 'light';
  className?: string | undefined;
}

export function TrustBadges({ tone = 'dark', className }: TrustBadgesProps) {
  return (
    <ul className={cx(styles.badges, tone === 'light' && styles.light, className)}>
      {BADGES.map(({ icon: Icon, title, note }) => (
        <li key={title} className={styles.badge}>
          <span className={styles.icon}>
            <Icon />
          </span>

          <span>
            <span className={styles.title}>{title}</span>
            <br />
            <span className={styles.note}>{note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
