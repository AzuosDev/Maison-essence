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
 * A pagina do produto, montada.
 *
 * A ordem na tela e a ordem da duvida: ver, precificar, escolher, saber
 * quando chega, ler o resto, olhar as outras opcoes. Nada aqui busca dado
 * proprio — o produto chega pronto de `product-page`, e cada bloco abaixo
 * pede o que so ele precisa (o parcelamento, as cidades, as paginas
 * institucionais), que e o que permite a pagina desenhar inteira antes de
 * qualquer um deles responder.
 *
 * ## A previa que vai para o WhatsApp
 *
 * `productMeta` monta titulo, descricao, Open Graph e o JSON-LD do produto,
 * e recebe a **variante escolhida**: o link dos 100ml compartilhado na
 * conversa mostra o frasco e o preco dos 100ml. O endereco canonico vai sem
 * o parametro de variante — e o mesmo produto, e duas URLs indexadas para
 * ele dividiriam a relevancia entre si.
 *
 * Uma ressalva honesta, que esta escrita tambem em `use-page-meta`: o
 * rastreador do WhatsApp le o HTML como ele chega do servidor e nao executa
 * JavaScript. Estas tags existem no documento depois que a aplicacao sobe —
 * o Google as le, o WhatsApp nao. Para a previa aparecer na conversa, o HTML
 * precisa nascer com elas, e e por isso que `productMeta` e uma funcao pura:
 * o prerender do build chama a mesma funcao e escreve o mesmo conteudo.
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
 * O endereco canonico, absoluto e sem parametro.
 *
 * Absoluto porque e o que vai no `og:url` e no `<link rel="canonical">`, e
 * rastreador nenhum resolve caminho relativo. A origem sai da janela em vez
 * de uma variavel de ambiente: a loja roda no dominio proprio e no endereco
 * de previa da Vercel, e fixar um deles faria a previa anunciar o outro.
 */
function canonicalUrl(slug: string): string {
  return `${window.location.origin}${ROUTES.product(slug)}`;
}

/**
 * Inicio / Categoria / Nome do produto.
 *
 * So a primeira categoria entra no caminho. O backend manda todas as que o
 * produto tem, ordenadas como a dona as ordenou no painel — e um fio de pao
 * com tres categorias irmas lado a lado nao descreve caminho nenhum: diz
 * onde mais o produto aparece, que e outra informacao e nao cabe aqui.
 */
function breadcrumbFor(product: PublicProductDetail): BreadcrumbItem[] {
  const [category] = product.categories;

  return [
    { label: 'Inicio', to: ROUTES.home },
    ...(category === undefined
      ? []
      : [{ label: category.name, to: ROUTES.category(category.slug) }]),
    { label: product.name },
  ];
}
