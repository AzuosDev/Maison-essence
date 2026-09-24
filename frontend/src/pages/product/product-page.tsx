import { useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { MessageScreen } from '@/components/store';
import { Button, ButtonLink, Container, Skeleton, SkeletonText } from '@/components/ui';
import { useProduct } from '@/features/catalog';
import { isApiError } from '@/lib/http';
import { ProductView } from './product-view';
import styles from './product-view.module.css';

/**
 * `/produtos/:slug`.
 *
 * Este módulo faz três coisas e nenhuma delas e desenhar a página: busca o
 * produto, decide entre esqueleto, recusa e conteúdo, e passa o resto para
 * `ProductView`. A separação e o que mantem a vista livre de `undefined` —
 * ela recebe um produto que existe, e não uma consulta que talvez tenha
 * respondido.
 *
 * ## O `key`
 *
 * A vista e remontada a cada produto. Sem isso, ir de um relacionado a outro
 * — mesma rota, slug diferente — reaproveitaria o componente e levaria junto
 * o índice da foto que estava aberta no produto anterior: o cliente clicaria
 * no terceiro relacionado e abriria a terceira foto dele, que e uma escolha
 * que ninguém fez.
 *
 * ## Quatro estados, três telas
 *
 * O produto que não existe (404) e o produto que não carregou (rede, 500)
 * são recusas diferentes e recebem textos diferentes: no primeiro não
 * adianta tentar de novo, e a saída e a vitrine; no segundo adianta, e o
 * botão tenta. Tratar os dois com a mesma mensagem genérica mandaria o
 * cliente recarregar uma página que nunca vai existir.
 */
export default function ProductPage() {
  const { slug = '' } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);

  if (isPending) {
    return <ProductSkeleton />;
  }

  if (isError) {
    return isApiError(error) && error.status === 404 ? (
      <NotFound />
    ) : (
      <LoadFailed onRetry={refetch} />
    );
  }

  return <ProductView key={product.slug} product={product} />;
}

/* ---- As recusas --------------------------------------------------------- */

function NotFound() {
  return (
    <MessageScreen
      code="404"
      title="Este produto não esta mais aqui"
      description="Ele pode ter saido do catálogo ou o endereço veio com um erro de digitação. A vitrine continua cheia."
      actions={
        <>
          <ButtonLink to={ROUTES.products}>Ver todos os produtos</ButtonLink>
          <ButtonLink to={ROUTES.home} variant="secondary">
            Voltar ao início
          </ButtonLink>
        </>
      }
    />
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <MessageScreen
      title="Não foi possível carregar este produto"
      description="A conexão falhou no meio do caminho. O produto continua no catálogo."
      actions={
        <Button
          onClick={() => {
            onRetry();
          }}
        >
          Tentar de novo
        </Button>
      }
    />
  );
}

/* ---- O esqueleto -------------------------------------------------------- */

/**
 * A página antes do produto.
 *
 * Desenha a mesma grade da vista, com a moldura da foto na proporção final:
 * quando a resposta chega, o conteúdo entra no lugar que já estava reservado
 * e nada abaixo dele salta. Um `Spinner` centralizado custaria o mesmo tempo
 * e entregaria a página inteira de uma vez, depois de um buraco branco.
 *
 * Quem passou o mouse pelo card antes de clicar não vê isto: o produto já
 * esta no cache, prebuscado, e a página abre pronta.
 */
function ProductSkeleton() {
  return (
    <Container className={styles.page}>
      <Skeleton variant="text" width="14rem" className={styles.breadcrumb} />

      <div className={styles.main}>
        <div className={styles.media}>
          <Skeleton className={styles.skeletonFrame} />
        </div>

        <div className={styles.column}>
          <div className={styles.skeletonBlock}>
            <Skeleton variant="text" width="6rem" />
            <Skeleton variant="title" width="80%" />
            <Skeleton variant="text" width="10rem" />
            <SkeletonText lines={2} />
            <Skeleton height="3rem" />
          </div>
        </div>
      </div>
    </Container>
  );
}
