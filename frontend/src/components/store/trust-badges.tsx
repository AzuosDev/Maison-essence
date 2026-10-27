import { cx } from '@/lib/cx';
import { BoxIcon, CardIcon, ShieldIcon, TruckIcon, WhatsappIcon } from './icons';
import styles from './trust-badges.module.css';

/**
 * Os selos de confiança.
 *
 * Texto fixo, e não vindo da API: são afirmações sobre como a loja opera —
 * envia para o Brasil inteiro, tem produto em mãos, o cartão parcela, a dona
 * atende — e não configuração que se ajusta de um dia para o outro. Quando
 * alguma delas deixar de ser verdade, o certo e mudar aqui, com revisão, e
 * não num campo de texto do painel.
 *
 * ## Dois conjuntos, e por que não um só
 *
 * A mesma faixa aparece duas vezes para quem percorre a home inteira: uma no
 * meio da página e outra no rodapé, que esta em toda tela da loja. Com os
 * quatro selos idênticos nos dois lugares, o cliente lia a mesma coisa duas
 * vezes em pouco mais de uma tela de rolagem — o que não reforca a mensagem,
 * só faz a página parecer montada duas vezes.
 *
 * Então são dois conjuntos. O do **rodapé** fecha a loja e termina no selo
 * que todo e-commerce precisa ter ("site seguro"). O da **home** gasta os
 * quatro slots no que esta loja tem de diferente das concorrentes, nas
 * palavras da dona: chega em todo o Brasil, tem produto em mãos hoje,
 * parcela no cartão e **atende uma a uma, no WhatsApp**. O último não cabia
 * quando "site seguro" ocupava a vaga — e e justamente um dos dois
 * diferenciais que ela nomeou.
 */

const SHIPPING = {
  icon: TruckIcon,
  title: 'Envio para todo o Brasil',
} as const;

const READY = {
  icon: BoxIcon,
  title: 'Pronta entrega',
} as const;

const CARD = {
  icon: CardIcon,
  title: 'Parcelamento no cartão',
} as const;

/**
 * As notas diferem entre os dois conjuntos de propósito.
 *
 * Mesmo título, outra frase: quem lê as duas faixas recebe informação nova
 * na segunda, em vez da sensação de já ter lido aquilo.
 */
const BADGE_SETS = {
  home: [
    { ...SHIPPING, note: 'Correios e transportadora, com taxa fixa nas cidades atendidas.' },
    { ...READY, note: 'O que está em mãos sai hoje. Retirada combinada em Juazeiro do Norte.' },
    { ...CARD, note: 'Parcelas sem juros no site; as demais a gente combina.' },
    {
      icon: WhatsappIcon,
      title: 'Atendimento direto',
      note: 'Fixação, foto do frasco, prazo: quem responde é a loja, no WhatsApp.',
    },
  ],
  footer: [
    { ...SHIPPING, note: 'Entrega com taxa fixa nas cidades atendidas.' },
    { ...READY, note: 'O que está em mãos sai primeiro. Retirada em Juazeiro do Norte.' },
    { ...CARD, note: 'Combinado direto com a gente, pelo WhatsApp.' },
    {
      icon: ShieldIcon,
      title: 'Site seguro',
      note: 'Seus dados trafegam protegidos, do início ao fim.',
    },
  ],
} as const;

/**
 * O tom, conforme o fundo em que a faixa cai.
 *
 * `dark` e o rodapé preto, que e onde os selos nasceram; `light` e a faixa da
 * home, sobre o branco. São as mesmas cores da paleta com os papéis trocados,
 * declaradas como variáveis no CSS Module — não há cor nova no sistema, e não
 * há um segundo componente de selos para manter em sincronia com este.
 */
interface TrustBadgesProps {
  tone?: 'dark' | 'light';
  /** Qual dos dois conjuntos de frases. Ver o cabeçalho do arquivo. */
  set?: keyof typeof BADGE_SETS;
  className?: string | undefined;
}

export function TrustBadges({ tone = 'dark', set = 'footer', className }: TrustBadgesProps) {
  return (
    <ul className={cx(styles.badges, tone === 'light' && styles.light, className)}>
      {BADGE_SETS[set].map(({ icon: Icon, title, note }) => (
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
