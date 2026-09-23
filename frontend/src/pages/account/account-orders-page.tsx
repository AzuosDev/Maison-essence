import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { AccountInvite, OrderCard } from '@/components/account';
import { BoxIcon } from '@/components/store';
import { ButtonLink, EmptyState, Pagination, Skeleton } from '@/components/ui';
import { useIsSignedIn, useMyOrders } from '@/features/account';
import { useStoreSettings } from '@/features/settings';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-orders-page.module.css';

/**
 * `/conta/pedidos`: o motivo pelo qual a conta existe.
 *
 * ## Sem sessao, o convite — e no mesmo endereco
 *
 * Nao ha redirecionamento. Quem digitou este endereco continua nele, lendo o
 * que ha atras da porta e com duas maneiras de abri-la. Ver `AccountInvite`:
 * a diferenca entre um convite e uma parede e que o convite tambem mostra a
 * saida.
 *
 * ## O vazio tem duas leituras, e a tela cobre as duas
 *
 * "Nenhum pedido" pode significar que a pessoa nunca comprou — e ai o que
 * falta e a vitrine — ou que ela comprou **com outro numero**, como
 * convidada, e os pedidos ficaram naquele telefone. O segundo caso e
 * invisivel e frustrante: ela sabe que comprou, e a tela diz que nao.
 *
 * Por isso o estado vazio traz as duas saidas: o caminho para a loja e a
 * explicacao de que o vinculo e pelo telefone.
 */
export default function AccountOrdersPage() {
  const signedIn = useIsSignedIn();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useMyOrders(page);
  const { settings } = useStoreSettings();

  usePageMeta({
    title: 'Meus pedidos — Maison Essence',
    description: 'O historico das suas compras na Maison Essence.',
    robots: 'noindex',
  });

  if (!signedIn) {
    return (
      <AccountInvite
        title="Seus pedidos ficam guardados aqui"
        description="Entre para acompanhar o que voce comprou, repetir um pedido com um toque e guardar seus enderecos de entrega."
      />
    );
  }

  const orders = data?.items ?? [];

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Meus pedidos</h1>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : isLoading ? (
        <div className={styles.list} aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height="9.5rem" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          as="h2"
          icon={<BoxIcon width="24" height="24" />}
          title="Nenhum pedido nesta conta ainda"
          description={
            <>
              Se voce ja comprou aqui, pode ter sido com outro telefone: o pedido fica ligado ao
              numero informado no fechamento. Fale com a loja pelo WhatsApp que ela ajusta.
            </>
          }
          actions={<ButtonLink to={ROUTES.products}>Ver os perfumes</ButtonLink>}
        />
      ) : (
        <>
          <div className={styles.list}>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                storeNumber={settings?.whatsappNumber ?? ''}
              />
            ))}
          </div>

          {(data?.totalPages ?? 1) > 1 ? (
            <Pagination
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
