import { useState } from 'react';
import { AccountInvite, AddressCard, AddressDialog } from '@/components/account';
import { PinIcon, PlusIcon } from '@/components/store';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';
import {
  MAX_ADDRESSES,
  addAddress,
  editAddress,
  makeDefault,
  removeAddress,
  toInputs,
  useIsSignedIn,
  useProfile,
  useSaveAddresses,
  type AccountAddress,
  type AddressForm,
  type AddressInput,
} from '@/features/account';
import { useDeliveryCities } from '@/features/delivery';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './account-addresses-page.module.css';

/**
 * `/conta/enderecos`.
 *
 * ## Toda acao manda a lista inteira
 *
 * A API nao tem rota por endereco: `PATCH /customer/me` recebe `addresses` e
 * substitui o que esta gravado. Adicionar, editar, marcar como padrao e
 * excluir sao a mesma chamada com listas diferentes, e as quatro listas sao
 * montadas em `address-list.ts`, fora daqui, porque a regra do "exatamente
 * um padrao" e a parte que nao perdoa distracao.
 *
 * ## A lista base e sempre a do servidor
 *
 * `toInputs(profile.addresses)`, e nunca um rascunho guardado nesta tela.
 * A diferenca aparece no caso real: a pessoa edita um endereco no celular e
 * marca outro como padrao no computador, na mesma tarde. Se o computador
 * mandasse a lista que tinha em maos quando a pagina abriu, a edicao do
 * celular seria apagada — e ninguem saberia por que.
 *
 * Com a lista do cache (que a resposta do proprio `PATCH` atualiza a cada
 * gravacao), a janela em que isso pode acontecer encolhe para o intervalo
 * entre duas revalidacoes.
 *
 * ## O teto de dez e do servidor, e a tela o respeita antes
 *
 * `ArrayMaxSize(10)` recusaria o decimo primeiro com um erro de validacao.
 * Esconder o botao ao chegar no teto, com a frase explicando, e melhor do
 * que deixar preencher oito campos para receber uma recusa no fim.
 */
export default function AccountAddressesPage() {
  const signedIn = useIsSignedIn();
  const { data: profile, isLoading } = useProfile();
  const { data: cities } = useDeliveryCities();
  const { save, isPending, error, reset } = useSaveAddresses();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountAddress | undefined>();

  usePageMeta({
    title: 'Meus endereços — Maison Essence',
    description: 'Os endereços salvos na sua conta.',
    robots: 'noindex',
  });

  if (!signedIn) {
    return (
      <AccountInvite
        title="Seus endereços salvos"
        description="Entre para guardar onde você recebe os pedidos e não digitar tudo de novo no próximo fechamento."
      />
    );
  }

  const addresses = profile?.addresses ?? [];
  const base = toInputs(addresses);

  /** Grava a lista e avisa. A base e sempre a que o servidor devolveu. */
  const commit = async (next: AddressInput[], done: string): Promise<void> => {
    try {
      await save(next);
      toast({ title: done, variant: 'success' });
      setDialogOpen(false);
    } catch (failure) {
      toast({
        title: 'Não deu para salvar',
        description: errorMessage(failure),
        variant: 'danger',
      });
    }
  };

  const submit = (values: AddressForm, id: string | undefined): void => {
    void commit(
      id === undefined ? addAddress(base, values) : editAddress(base, id, values),
      id === undefined ? 'Endereço salvo.' : 'Endereço atualizado.',
    );
  };

  const openNew = (): void => {
    reset();
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (address: AccountAddress): void => {
    reset();
    setEditing(address);
    setDialogOpen(true);
  };

  const atLimit = addresses.length >= MAX_ADDRESSES;

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Meus endereços</h1>

        {atLimit || isLoading ? null : (
          <Button type="button" variant="secondary" onClick={openNew}>
            <PlusIcon />
            Novo endereço
          </Button>
        )}
      </div>

      {atLimit ? (
        <p className={styles.limit}>
          Sua conta já guarda {MAX_ADDRESSES} endereços, que e o máximo. Exclua um para adicionar
          outro.
        </p>
      ) : null}

      {isLoading ? (
        <div className={styles.list} aria-busy="true">
          <Skeleton height="11rem" />
          <Skeleton height="11rem" />
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          as="h2"
          icon={<PinIcon width="24" height="24" />}
          title="Nenhum endereço salvo"
          description="Guarde onde você recebe os pedidos e o próximo fechamento fica mais curto."
          actions={
            <Button type="button" onClick={openNew}>
              Adicionar endereço
            </Button>
          }
        />
      ) : (
        <div className={styles.list}>
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              cityName={cityNameOf(cities, address.cityId)}
              busy={isPending}
              onEdit={openEdit}
              onMakeDefault={(target) => {
                void commit(makeDefault(base, target.id), 'Endereço padrão atualizado.');
              }}
              onDelete={(target) => {
                void commit(removeAddress(base, target.id), 'Endereço excluído.');
              }}
            />
          ))}
        </div>
      )}

      <AddressDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
        }}
        address={editing}
        onSubmit={submit}
        isPending={isPending}
        error={error}
        isFirst={addresses.length === 0}
      />
    </section>
  );
}

/**
 * O nome da cidade a partir do id guardado no endereco.
 *
 * Vazio quando a cidade nao esta mais na lista — a loja pode ter deixado de
 * atende-la. O endereco continua valendo e continua aparecendo; o que some e
 * a linha da cidade, que seria uma informacao falsa sobre a area de entrega.
 */
function cityNameOf(
  cities: readonly { id: string; name: string; state: string }[] | undefined,
  cityId: string | null,
): string {
  if (cityId === null) {
    return '';
  }

  const city = cities?.find((candidate) => candidate.id === cityId);

  return city === undefined ? '' : `${city.name}/${city.state}`;
}
