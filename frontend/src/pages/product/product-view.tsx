import { ROUTES } from '@/app/routes';
import { Breadcrumb, Container, type BreadcrumbItem } from '@/components/ui';
import { productMeta, type PublicProductDetail } from '@/features/catalog';
import { usePageMeta } from '@/lib/use-page-meta';
import { BuyBox } from './buy-box';
import { DeliveryEstimate } from './delivery-estimate';
import { ProductGallery } from './product-gallery';
import { ProductTabs } from './product-tabs';
import { RelatedProducts } from './related-products';
import { useProductSelection } from './use-product-selection';
import styles from './product-view.module.css';

/**
 * A página do produto, montada.
 *
 * A ordem na tela e a ordem da dúvida: ver, precificar, escolher, saber
 * quando chega, ler o resto, olhar as outras opções. Nada aqui busca dado
 * próprio — o produto chega pronto de `product-page`, e cada bloco abaixo
 * pede o que só ele precisa (o parcelamento, as cidades, as páginas
 * institucionais), que e o que permite a página desenhar inteira antes de
 * qualquer um deles responder.
 *
 * ## A prévia que vai para o WhatsApp
 *
 * `productMeta` monta título, descrição, Open Graph e o JSON-LD do produto,
 * e recebe a **variante escolhida**: o link dos 100ml compartilhado na
 * conversa mostra o frasco e o preço dos 100ml. O endereço canônico vai sem
 * o parâmetro de variante — e o mesmo produto, e duas URLs indexadas para
 * ele dividiriam a relevância entre si.
 *
 * Uma ressalva honesta, que esta escrita também em `use-page-meta`: o
 * rastreador do WhatsApp lê o HTML como ele chega do servidor e não executa
 * JavaScript. Estas tags existem no documento depois que a aplicação sobe —
 * o Google as lê, o WhatsApp não. Para a prévia aparecer na conversa, o HTML
 * precisa nascer com elas, e e por isso que `productMeta` e uma função pura:
 * o prerender do build chama a mesma função e escreve o mesmo conteúdo.
 */
export function ProductView({ product }: { product: PublicProductDetail }) {
  const { variant, gallery, imageIndex, selectVariant, showImage } = useProductSelection(product);

  usePageMeta(productMeta({ product, variant, url: canonicalUrl(product.slug) }));

  return (
    <>
      <Container className={styles.page}>
        <Breadcrumb items={breadcrumbFor(product)} className={styles.breadcrumb} />

        <div className={styles.main}>
          <div className={styles.media}>
            <ProductGallery
              images={gallery}
              alt={product.name}
              index={imageIndex}
              onIndexChange={showImage}
            />
          </div>

          <div className={styles.column}>
            <BuyBox product={product} variant={variant} onSelectVariant={selectVariant} />

            <DeliveryEstimate />
          </div>
        </div>

        <ProductTabs product={product} />
      </Container>

      <RelatedProducts products={product.related} />
    </>
  );
}

/**
 * O endereço canônico, absoluto e sem parâmetro.
 *
 * Absoluto porque e o que vai no `og:url` e no `<link rel="canonical">`, e
 * rastreador nenhum resolve caminho relativo. A origem sai da janela em vez
 * de uma variável de ambiente: a loja roda no domínio próprio e no endereço
 * de prévia da Vercel, e fixar um deles faria a prévia anunciar o outro.
 */
function canonicalUrl(slug: string): string {
  return `${window.location.origin}${ROUTES.product(slug)}`;
}

/**
 * Início / Categoria / Nome do produto.
 *
 * Só a primeira categoria entra no caminho. O backend manda todas as que o
 * produto tem, ordenadas como a dona as ordenou no painel — e um fio de pão
 * com três categorias irmas lado a lado não descreve caminho nenhum: diz
 * onde mais o produto aparece, que e outra informação e não cabe aqui.
 */
function breadcrumbFor(product: PublicProductDetail): BreadcrumbItem[] {
  const [category] = product.categories;

  return [
    { label: 'Início', to: ROUTES.home },
    ...(category === undefined
      ? []
      : [{ label: category.name, to: ROUTES.category(category.slug) }]),
    { label: product.name },
  ];
}
