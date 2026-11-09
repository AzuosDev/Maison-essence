import { ROUTES } from '@/app/routes';
import { ButtonLink, Container } from '@/components/ui';
import { campaignDeadlineLabel, hasShowcase, type PublicCampaign } from '@/features/campaign';
import styles from './campaign-strip.module.css';

/**
 * A faixa da campanha, logo abaixo do banner.
 *
 * ## Por que aqui, e não como aba no menu
 *
 * Porque a promoção não e uma seção da loja, e um prazo. Uma aba "Promoções"
 * no menu preto fica lá em janeiro, em março e em todo mês sem campanha
 * nenhuma — e quando ha campanha, ela espera que alguém pense em clicar. A
 * faixa aparece quando ha o que anunciar, some quando não ha, e cai no caminho
 * de quem desceu do banner.
 *
 * ## Por que estática, e não flutuando
 *
 * Esta loja já tem dois elementos flutuantes nos cantos de baixo — o botão do
 * WhatsApp e o balão do brinde —, e um terceiro aviso pairando seria o
 * terceiro a disputar o mesmo polegar. A faixa fica no fluxo: empurra o
 * conteúdo uma vez, quando chega, e depois pertence a página como qualquer
 * seção.
 *
 * ## As quatro informações, nessa ordem
 *
 * O nome grande, a linha de apoio embaixo, o desconto em dourado, o código com
 * o prazo. E a hierarquia que o painel promete em `CampaignPreview`, e as duas
 * precisam continuar iguais: a dona escreve o nome da campanha olhando aquela
 * miniatura, e uma faixa que colocasse o desconto antes do nome faria a
 * pré-visualização mentir sobre o que ela estava decidindo.
 *
 * ## A escassez, quando ela e verdade
 *
 * `scarcityLabel` vem escrito do servidor, e vem **vazio** nos três casos em
 * que contar não seria honesto: cupom sem teto, teto folgado e cupom esgotado.
 * Esta faixa não sabe contar cupom nenhum, e e de propósito — a tentação de
 * fabricar "últimas unidades" morre na ausência do dado.
 *
 * ## O atalho que pode não existir
 *
 * Cupom da loja inteira não tem vitrine própria: não ha recorte a mostrar, e o
 * endereço da campanha repetiria o catálogo com outro título. Nesse caso o
 * atalho leva a vitrine normal, que e para onde a cliente ia de todo jeito.
 */

export interface CampaignStripProps {
  campaign: PublicCampaign;
  /** Injetado nos testes; na loja e sempre agora. */
  now?: Date;
}

export function CampaignStrip({ campaign, now }: CampaignStripProps) {
  const deadline = campaignDeadlineLabel(campaign.endsAt, now ?? new Date());
  const showcase = hasShowcase(campaign);

  return (
    <section className={styles.band} aria-labelledby="campanha-no-ar">
      {/* A areia sangra até a borda da tela; o conteúdo volta para a régua da
          esquerda, onde começa todo o resto da página. */}
      <Container className={styles.strip}>
        <div className={styles.copy}>
          {/*
            `h2` e não `h3`: na home esta faixa e uma seção de primeiro nível,
            igual as prateleiras — e o sumário de títulos de quem navega por
            cabeçalho precisa mostrar a promoção junto com "Mais vendidos", e
            não aninhada debaixo de nada.
          */}
          <h2 id="campanha-no-ar" className={styles.title}>
            {campaign.title}
          </h2>

          {campaign.tagline === '' ? null : (
            <p className={styles.tagline}>{campaign.tagline}</p>
          )}
        </div>

        <div className={styles.offer}>
          <span className={styles.discount}>{campaign.discountLabel}</span>

          {/*
            O código como o que ele e: um cupom a destacar, com o filete
            tracejado que e o pontilhado de onde se recorta.

            O rótulo "cupom" em cima e o que impede o retângulo de ser lido
            como um selo qualquer. Em voz alta ele sai como "cupom
            BLACKFRIDAY", que e a frase inteira de que alguém precisa.
          */}
          <span className={styles.coupon}>
            <span className={styles.couponLabel}>cupom</span>
            <span className={styles.code}>{campaign.code}</span>
          </span>

          <span className={styles.terms}>
            {deadline === '' ? null : <span className={styles.deadline}>{deadline}</span>}

            {campaign.scarcityLabel === '' ? null : (
              <span className={styles.scarcity}>{campaign.scarcityLabel}</span>
            )}
          </span>
        </div>

        <ButtonLink
          to={showcase ? ROUTES.campaign(campaign.slug) : ROUTES.products}
          variant="secondary"
          className={styles.shortcut}
        >
          {showcase ? 'Ver os produtos' : 'Ver a vitrine'}
        </ButtonLink>
      </Container>
    </section>
  );
}
