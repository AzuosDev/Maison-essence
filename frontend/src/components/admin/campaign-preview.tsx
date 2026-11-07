import { cx } from '@/lib/cx';
import styles from './campaign-preview.module.css';

/**
 * Como a campanha aparece na home, enquanto ela ainda e rascunho.
 *
 * ## Por que esta tela precisa de uma pré-visualização
 *
 * Porque `title` e `tagline` são os dois campos do cadastro que não fazem nada
 * no painel. Código, desconto, prazo e limite têm consequência visível aqui —
 * a régua se move, o selo muda. O nome da campanha e a linha que a anuncia só
 * existem na loja aberta, e pedir que a dona escreva no escuro e depois vá
 * conferir na home e pedir que ela publique para ver.
 *
 * ## O que ela promete, e o que não
 *
 * Promete as quatro informações que a faixa carrega, na hierarquia em que ela
 * as põe: o nome grande, a linha de apoio embaixo, o desconto em dourado e o
 * código com o prazo. Não promete a medida exata da faixa na home, e por isso
 * ela esta num bloco do painel com a sua própria moldura, e não numa simulação
 * de largura de tela — uma miniatura que finge ser a home erra nos dois
 * trabalhos.
 *
 * ## Areia e não laje
 *
 * A faixa da campanha vive sobre areia na home, como toda seção que precisa se
 * separar da vizinha de mesmo tom. Os blocos escuros desta loja são três e só
 * três — avisos, menu, rodapé —, e abrir um quarto para a promoção seria
 * trocar a regra da laje por um efeito.
 */

export interface CampaignPreviewProps {
  title: string;
  tagline: string;
  /** `20% OFF`. Vazio enquanto o desconto não tem número. */
  discountLabel: string;
  code: string;
  /** `30/11`, ou vazio para campanha sem prazo. */
  deadline: string;
  /**
   * A campanha tem vitrine própria em `/promocao/<slug>`.
   *
   * Cupom da loja inteira não tem — não há recorte a mostrar —, e nesse caso o
   * atalho da faixa não existe. Dizer isso aqui evita a pergunta "e o botão de
   * ver os produtos, por que não aparece?".
   */
  hasShowcase: boolean;
  className?: string | undefined;
}

export function CampaignPreview({
  title,
  tagline,
  discountLabel,
  code,
  deadline,
  hasShowcase,
  className,
}: CampaignPreviewProps) {
  return (
    <div className={cx(styles.preview, className)}>
      {/*
        `aria-hidden` na faixa inteira: ela e a repetição visual de campos que
        quem navega por teclado acabou de preencher, e anunciá-la de novo faria
        o leitor de tela ler o formulário duas vezes. A frase do pé fica, porque
        ela conta uma regra que não esta em campo nenhum.
      */}
      <div className={styles.strip} aria-hidden="true">
        <div className={styles.copy}>
          <strong className={cx(styles.title, title === '' && styles.waiting)}>
            {title === '' ? 'O nome da campanha' : title}
          </strong>

          {tagline === '' ? null : <span className={styles.tagline}>{tagline}</span>}
        </div>

        <div className={styles.offer}>
          <span className={cx(styles.discount, 'tabular')}>
            {discountLabel === '' ? '—' : discountLabel}
          </span>

          <span className={styles.coupon}>
            <span className={styles.couponLabel}>cupom</span>
            <span className={styles.code}>{code === '' ? 'CÓDIGO' : code}</span>
          </span>

          {deadline === '' ? null : <span className={styles.deadline}>{`até ${deadline}`}</span>}
        </div>

        {hasShowcase ? <span className={styles.shortcut}>Ver os produtos</span> : null}
      </div>

      <p className={styles.note}>
        A home anuncia uma campanha por vez, a que termina primeiro entre as que estão no ar com o
        anúncio ligado.
        {hasShowcase
          ? ' Os produtos escolhidos ganham uma vitrine própria, no endereço da campanha.'
          : ' Cupom da loja inteira não tem vitrine própria: o desconto vale no catálogo todo.'}
      </p>
    </div>
  );
}
