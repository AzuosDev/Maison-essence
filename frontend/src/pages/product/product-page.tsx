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
 * Este modulo faz tres coisas e nenhuma delas e desenhar a pagina: busca o
 * produto, decide entre esqueleto, recusa e conteudo, e passa o resto para
 * `ProductView`. A separacao e o que mantem a vista livre de `undefined` —
 * ela recebe um produto que existe, e nao uma consulta que talvez tenha
 * respondido.
 *
 * ## O `key`
 *
 * A vista e remontada a cada produto. Sem isso, ir de um relacionado a outro
 * — mesma rota, slug diferente — reaproveitaria o componente e levaria junto
 * o indice da foto que estava aberta no produto anterior: o cliente clicaria
 * no terceiro relacionado e abriria a terceira foto dele, que e uma escolha
 * que ninguem fez.
 *
 * ## Quatro estados, tres telas
 *
 * O produto que nao existe (404) e o produto que nao carregou (rede, 500)
 * sao recusas diferentes e recebem textos diferentes: no primeiro nao
 * adianta tentar de novo, e a saida e a vitrine; no segundo adianta, e o
 * botao tenta. Tratar os dois com a mesma mensagem generica mandaria o
 * cliente recarregar uma pagina que nunca vai existir.
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
      description="Ele pode ter saido do catalogo ou o endereço veio com um erro de digitação. A vitrine continua cheia."
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
      description="A conexão falhou no meio do caminho. O produto continua no catalogo."
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
 * A pagina antes do produto.
 *
 * Desenha a mesma grade da vista, com a moldura da foto na proporcao final:
 * quando a resposta chega, o conteudo entra no lugar que ja estava reservado
 * e nada abaixo dele salta. Um `Spinner` centralizado custaria o mesmo tempo
 * e entregaria a pagina inteira de uma vez, depois de um buraco branco.
 *
 * Quem passou o mouse pelo card antes de clicar nao ve isto: o produto ja
 * esta no cache, prebuscado, e a pagina abre pronta.
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
