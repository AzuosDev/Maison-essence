import { cx } from '@/lib/cx';
import { CardIcon, TruckIcon, WhatsappIcon } from './icons';
import styles from './trust-badges.module.css';

/**
 * Os selos de confiança.
 *
 * Texto fixo, e não vindo da API: são afirmações sobre como a loja opera —
 * envia para o Brasil inteiro, o cartão parcela, a dona atende — e não
 * configuração que se ajusta de um dia para o outro. Quando alguma delas
 * deixar de ser verdade, o certo e mudar aqui, com revisão, e não num campo
 * de texto do painel.
 *
 * ## Uma faixa só, e na home
 *
 * Houve um segundo conjunto no rodapé, que esta em toda tela da loja. Ele
 * saiu: caía a meia tela de rolagem deste, repetia as mesmas frases com
 * outras palavras e, estando no rodapé, chegava depois de a visitante já ter
 * decidido. Quem fecha a loja agora e a newsletter e a linha legal.
 *
 * ## Três slots, e o que coube neles
 *
 * O que esta loja tem de diferente das concorrentes, nas palavras da dona:
 * chega em todo o Brasil, parcela no cartão e **atende uma a uma, no
 * WhatsApp** — este último, um dos dois diferenciais que ela nomeou.
 *
 * "Pronta entrega" era o quarto e saiu com o rodapé: como promessa da loja
 * inteira ela não se sustenta, porque vale frasco a frasco. Quem a diz
 * continua dizendo no lugar certo — o selo verde do cartão e da página do
 * produto, que nasce do cadastro de cada um.
 */
const BADGES = [
  {
    icon: TruckIcon,
    title: 'Envio para todo o Brasil',
    note: 'Correios e transportadora, com taxa fixa nas cidades atendidas.',
  },
  {
    icon: CardIcon,
    title: 'Parcelamento no cartão',
    note: 'Parcelas sem juros no site; as demais a gente combina.',
  },
  {
    icon: WhatsappIcon,
    title: 'Atendimento direto',
    note: 'Fixação, foto do frasco, prazo: quem responde é a loja, no WhatsApp.',
  },
] as const;

interface TrustBadgesProps {
  className?: string | undefined;
}

export function TrustBadges({ className }: TrustBadgesProps) {
  return (
    <ul className={cx(styles.badges, className)}>
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
