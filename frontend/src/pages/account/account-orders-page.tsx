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
 * ## Sem sessão, o convite — e no mesmo endereço
 *
 * Não há redirecionamento. Quem digitou este endereço continua nele, lendo o
 * que há atrás da porta e com duas maneiras de abri-lá. Ver `AccountInvite`:
 * a diferença entre um convite e uma parede e que o convite também mostra a
 * saída.
 *
 * ## O vazio tem duas leituras, e a tela cobre as duas
 *
 * "Nenhum pedido" pode significar que a pessoa nunca comprou — e aí o que
 * falta e a vitrine — ou que ela comprou **com outro número**, como
 * convidada, e os pedidos ficaram naquele telefone. O segundo caso e
 * invisível e frustrante: ela sabe que comprou, e a tela diz que não.
 *
 * Por isso o estado vazio traz as duas saídas: o caminho para a loja e a
 * explicação de que o vínculo e pelo telefone.
 */
export default function AccountOrdersPage() {
  const signedIn = useIsSignedIn();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useMyOrders(page);
  const { settings } = useStoreSettings();

  usePageMeta({
    title: 'Meus pedidos — Maison Essence',
    description: 'O histórico das suas compras na Maison Essence.',
    robots: 'noindex',
  });

  if (!signedIn) {
    return (
      <AccountInvite
        title="Seus pedidos ficam guardados aqui"
        description="Entre para acompanhar o que você comprou, repetir um pedido com um toque e guardar seus endereços de entrega."
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
              Se você já comprou aqui, pode ter sido com outro telefone: o pedido fica ligado ao
              número informado no fechamento. Fale com a loja pelo WhatsApp que ela ajusta.
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
