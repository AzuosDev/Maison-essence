import { useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { MessageScreen } from '@/components/store';
import { ButtonLink, Skeleton } from '@/components/ui';
import { campaignDeadlineLabel, useCampaign, type PublicCampaign } from '@/features/campaign';
import { usePageMeta } from '@/lib/use-page-meta';
import { CatalogView } from '../catalog/catalog-view';
import styles from './campaign-page.module.css';

/**
 * A vitrine da campanha: `/promocao/:slug`.
 *
 * ## Por que ela e a listagem do catálogo, e não uma tela nova
 *
 * Porque e a mesma coisa com um filtro a mais. `GET /products?campaign=<slug>`
 * devolve os produtos do cupom com preço, parcela, selo de pronta entrega e
 * paginação — a mesma rota da vitrine —, então a campanha herda ordenação,
 * filtro de marca, faixa de preço, grade, esqueleto e "carregar mais" sem uma
 * linha escrita duas vezes. Uma tela própria seria uma segunda listagem para
 * manter em dia, e ela divergiria da primeira no primeiro ajuste.
 *
 * O que a campanha acrescenta e o bloco de oferta entre o título e a lista:
 * desconto, código e prazo. E o `banner` da listagem, que existe para isso.
 *
 * ## O endereço que acabou
 *
 * `404` e o caso esperado aqui, e não a exceção: o link da campanha circula no
 * WhatsApp e no story, e story não expira junto com o cupom. Quem abre um
 * endereço vencido merece ouvir que a promoção terminou e um caminho para a
 * vitrine — não a vitrine filtrada com o desconto que o fechamento já não da,
 * e muito menos uma tela de erro técnico.
 *
 * ## O endereço de uma campanha da loja inteira
 *
 * Não existe: `ROUTES.campaign` só e apontado quando ha recorte de produtos, e
 * a faixa da home manda para a vitrine normal no outro caso. Quem chegar aqui
 * por um link assim vê a página montada com a lista inteira do catálogo, que e
 * a verdade daquele cupom — ele vale em tudo.
 */
export default function CampaignPage() {
  const { slug = '' } = useParams();
  const { data: campaign, isPending, isError } = useCampaign(slug);

  usePageMeta({
    title: campaign === undefined ? 'Promoção — Maison Essence' : `${campaign.title} — Maison Essence`,
    description:
      campaign === undefined
        ? 'Os produtos em promoção na Maison Essence.'
        : campaign.tagline === ''
          ? `${campaign.discountLabel} com o cupom ${campaign.code}.`
          : campaign.tagline,
  });

  if (isError) {
    return (
      <MessageScreen
        title="Essa promoção terminou"
        description="A campanha saiu do ar e o cupom dela já não vale. Veja o que está em promoção agora."
        actions={
          <>
            <ButtonLink to={ROUTES.productsOnSale}>Ver as promoções</ButtonLink>
            <ButtonLink to={ROUTES.products} variant="secondary">
              Ver a vitrine
            </ButtonLink>
          </>
        }
      />
    );
  }

  return (
    <CatalogView
      title={campaign?.title ?? 'Promoção'}
      description={campaign?.tagline}
      breadcrumb={[
        { label: 'Início', to: ROUTES.home },
        { label: 'Promoções', to: ROUTES.productsOnSale },
        { label: campaign?.title ?? 'Promoção' },
      ]}
      context={{ campaign: slug }}
      isTitleLoading={isPending}
      banner={<Offer campaign={campaign} />}
      emptyTitle="Nenhum produto desta campanha agora"
      emptyDescription="Os produtos da promoção acabaram ou os filtros estreitaram demais. Fale com a gente no WhatsApp."
    />
  );
}

/* ---- O bloco da oferta ---------------------------------------------------- */

/**
 * Desconto, código e prazo, entre o título e a lista.
 *
 * Mesma anatomia da faixa da home — e precisa ser: quem clicou lá chega aqui,
 * e o código que ela viu tem de estar escrito do mesmo jeito, no mesmo
 * retângulo tracejado. Duas gramáticas para o mesmo cupom fariam a cliente
 * conferir se e o mesmo.
 *
 * O que muda em relação a faixa: aqui não ha atalho, porque esta **e** a
 * vitrine; e o título não se repete, porque o `h1` da página já o disse.
 *
 * Reserva a própria altura enquanto a campanha não chegou, em vez de aparecer
 * depois e empurrar a grade: a lista de produtos já esta sendo buscada em
 * paralelo e costuma chegar antes.
 */
function Offer({ campaign }: { campaign: PublicCampaign | undefined }) {
  if (campaign === undefined) {
    return (
      <div className={styles.offer} aria-busy="true">
        <Skeleton width="7rem" height="var(--text-28)" />
        <Skeleton width="10rem" height="2.75rem" />
      </div>
    );
  }

  const deadline = campaignDeadlineLabel(campaign.endsAt, new Date());

  return (
    <div className={styles.offer}>
      <span className={styles.discount}>{campaign.discountLabel}</span>

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

      {/* A frase que fecha o circuito. Sem ela, o retângulo com o código fica
          sendo um enfeite: ninguém e obrigado a saber que cupom se digita no
          fechamento, e esta e a única tela em que dizer isso ainda e cedo o
          bastante para servir. */}
      <p className={styles.how}>Aplique o cupom no fechamento do pedido.</p>
    </div>
  );
}
