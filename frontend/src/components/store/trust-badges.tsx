import { CardIcon, ShieldIcon, TruckIcon } from './icons';
import styles from './trust-badges.module.css';

/**
 * Os tres selos de confianca do rodape.
 *
 * Texto fixo, e nao vindo da API: sao afirmacoes sobre como a loja opera —
 * envia para o Brasil inteiro, o site e seguro, o cartao parcela — e nao
 * configuracao que a dona ajusta de um dia para o outro. Quando alguma delas
 * deixar de ser verdade, o certo e mudar aqui, com revisao, e nao num campo
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
    note: 'Seus dados trafegam protegidos, do inicio ao fim.',
  },
  {
    icon: CardIcon,
    title: 'Parcelamento no cartao',
    note: 'Combinado direto com a gente, pelo WhatsApp.',
  },
] as const;

export function TrustBadges() {
  return (
    <ul className={styles.badges}>
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
