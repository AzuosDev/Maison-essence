import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { ArrowLeftIcon, ConfirmDialog, DeliveryTable, PlusIcon } from '@/components/admin';
import { Button, EmptyState, Input, Modal, Skeleton, useToast } from '@/components/ui';
import {
  DELIVERY_LIMITS,
  canManageStore,
  cityDraftToCreate,
  emptyCityDraft,
  hasCityErrors,
  useAdminRole,
  useCreateDeliveryCity,
  useDeleteDeliveryCity,
  useDeliveryCities,
  useReorderDeliveryCities,
  useUpdateDeliveryCity,
  validateCity,
  type AdminDeliveryCity,
  type CityDraft,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-delivery-page.module.css';

/**
 * As cidades atendidas e o que se cobra em cada uma.
 *
 * ## Esta tela e uma planilha, e não um cadastro
 *
 * A dona não vem aqui cadastrar: ela vem **reajustar**. O combustível subiu e
 * cinco cidades mudam de taxa na mesma sessão, com os valores sendo comparados
 * uns com os outros enquanto ela digita. Por isso os campos ficam abertos, por
 * isso não há botão de salvar, e por isso a tela não tem busca nem paginação —
 * uma loja atende dez ou vinte cidades, e todas precisam caber na mesma vista.
 *
 * ## A ordem daqui e a ordem do checkout
 *
 * O seletor de cidade que a cliente vê segue esta lista, e e por isso que
 * arrastar importa: a cidade da loja fica em primeiro porque e a de quase todo
 * pedido, e deixa-lá no meio de uma lista alfabética custa um rolar a cada
 * compra.
 *
 * ## Desativar e o caminho normal de parar de atender
 *
 * Excluir apaga o cadastro e obriga a recadastrar tudo se a loja voltar a
 * atender ali. Desativar tira a cidade do checkout na hora e guarda a taxa. O
 * servidor aceita os dois; a tela deixa claro qual e qual.
 *
 * ## O que o STAFF vê
 *
 * Nada. A tabela de taxas e preço, e preço e da dona — o backend recusa
 * inclusive a leitura.
 */
export default function AdminDeliveryPage() {
  const role = useAdminRole();
  const { toast } = useToast();

  const { data: cities, isPending, isError, error } = useDeliveryCities();
  const create = useCreateDeliveryCity();
  const update = useUpdateDeliveryCity();
  const reorder = useReorderDeliveryCities();
  const remove = useDeleteDeliveryCity();

  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AdminDeliveryCity | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  usePageMeta({ title: 'Entrega — Painel', description: 'Acesso restrito.' });

  // O verde de "salvo" apaga sozinho. Um segundo e o bastante para ser visto
  // sem que a linha fique presa no estado de sucesso.
  useEffect(() => {
    if (savedId === null) {
      return;
    }

    const timer = setTimeout(() => {
      setSavedId(null);
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [savedId]);

  if (!canManageStore(role)) {
    return (
      <EmptyState
        as="h1"
        title="Esta área e de quem administra a loja"
        description="A tabela de taxas e preço. O seu acesso cobre o atendimento: o início do painel e os pedidos — e o pedido já carrega a taxa que foi combinada."
        actions={
          <Link to={ROUTES.admin.root} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o início
          </Link>
        }
      />
    );
  }

  const fail = (title: string) => (cause: unknown) => {
    toast({ variant: 'danger', title, description: errorMessage(cause) });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={styles.title}>Entrega</h1>

          <p className={styles.count} aria-live="polite">
            {summary(cities, isPending)}
          </p>
        </div>

        <Button
          type="button"
          className={styles.add}
          onClick={() => {
            setAdding(true);
          }}
        >
          <PlusIcon />
          Adicionar cidade
        </Button>
      </header>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : isPending ? (
        <div className={styles.skeleton} aria-busy="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height="4rem" />
          ))}
        </div>
      ) : cities.length === 0 ? (
        <EmptyState
          as="h2"
          title="Nenhuma cidade cadastrada"
          description="Sem cidade cadastrada, o checkout só oferece a retirada na loja. Comece pela cidade em que a loja esta — e a de quase todo pedido."
          actions={
            <Button
              type="button"
              onClick={() => {
                setAdding(true);
              }}
            >
              Cadastrar a primeira cidade
            </Button>
          }
        />
      ) : (
        <>
          <p className={styles.hint}>
            Cada campo grava ao sair dele — não há botão de salvar. Arraste para mudar a ordem em
            que as cidades aparecem no checkout.
          </p>

          <DeliveryTable
            cities={cities}
            savedId={savedId}
            isReordering={reorder.isPending}
            onReorder={(next) => {
              reorder.mutate(next, { onError: fail('A ordem voltou ao que era') });
            }}
            onSave={(city, changes) => {
              update.mutate(
                { id: city.id, input: changes },
                {
                  onSuccess: (saved) => {
                    setSavedId(saved.id);
                  },
                  onError: fail(`${city.name} continua como estava`),
                },
              );
            }}
            onToggleActive={(city) => {
              update.mutate(
                { id: city.id, input: { isActive: !city.isActive } },
                {
                  onSuccess: (saved) => {
                    setSavedId(saved.id);
                    toast({
                      variant: 'success',
                      title: saved.isActive
                        ? `${saved.name} voltou ao checkout`
                        : `${saved.name} saiu do checkout`,
                      description: saved.isActive
                        ? 'A cliente já pode escolher esta cidade.'
                        : 'A taxa fica guardada para quando voltar a atender.',
                    });
                  },
                  onError: fail(`${city.name} continua como estava`),
                },
              );
            }}
            onDelete={setDeleting}
          />
        </>
      )}

      <NewCityDialog
        open={adding}
        saving={create.isPending}
        onClose={() => {
          setAdding(false);
        }}
        onSubmit={(draft) => {
          create.mutate(cityDraftToCreate(draft), {
            onSuccess: (city) => {
              setAdding(false);
              setSavedId(city.id);
              toast({
                variant: 'success',
                title: `${city.name} entrou na lista`,
                description: 'Ela já aparece no checkout. Arraste para mudar a posição.',
              });
            },
            // A recusa mais comum e "essa cidade já esta cadastrada", e a
            // frase do servidor diz o que fazer no lugar.
            onError: fail('A cidade não foi cadastrada'),
          });
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting === null) {
            return;
          }

          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast({ variant: 'success', title: `${deleting.name} saiu da lista` });
              setDeleting(null);
            },
            onError: (cause) => {
              setDeleting(null);
              fail('A cidade não foi excluída')(cause);
            },
          });
        }}
        title="Excluir esta cidade?"
        description="A taxa e o prazo somem junto, e voltar a atender ali exige cadastrar tudo de novo. Se a ideia e parar por um tempo, desligue o interruptor da linha — a cliente deixa de ver a cidade e o cadastro fica guardado. Os pedidos já fechados não mudam: eles guardam a taxa que foi combinada."
        target={deleting === null ? '' : `${deleting.name}/${deleting.state}`}
        confirmLabel="Excluir a cidade"
        loading={remove.isPending}
      />
    </div>
  );
}

/* ---- A cidade nova ---------------------------------------------------------- */

/**
 * O cadastro de uma cidade.
 *
 * Um diálogo, e não uma linha vazia no fim da tabela: a linha em branco
 * entraria na lista antes de existir do outro lado, e um arraste ou um
 * recarregamento no meio do preenchimento a faria sumir sem explicação.
 *
 * Os quatro campos são os mesmos da tabela, e de propósito — o que se aprende
 * aqui vale lá. O que muda e que aqui eles são validados juntos, no envio, e
 * não um a um ao sair.
 */
function NewCityDialog({
  open,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: CityDraft) => void;
}) {
  if (!open) {
    return null;
  }

  return <NewCityForm saving={saving} onClose={onClose} onSubmit={onSubmit} />;
}

function NewCityForm({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: CityDraft) => void;
}) {
  const [draft, setDraft] = useState<CityDraft>(() => emptyCityDraft());
  const [touched, setTouched] = useState(false);

  const errors = touched ? validateCity(draft) : {};

  const set = (patch: Partial<CityDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = (): void => {
    setTouched(true);

    if (!hasCityErrors(validateCity(draft))) {
      onSubmit(draft);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar cidade"
      description="Ela entra no fim da lista do checkout; arraste depois para mudar a posição."
      footer={
        <div className={styles.dialogActions}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>

          <Button type="button" onClick={submit} loading={saving} loadingLabel="Salvando">
            Adicionar
          </Button>
        </div>
      }
    >
      <div className={styles.fields}>
        <div className={styles.pair}>
          <Input
            label="Cidade"
            block
            required
            maxLength={DELIVERY_LIMITS.name}
            placeholder="Sobral"
            value={draft.name}
            error={errors.name}
            onChange={(event) => {
              set({ name: event.target.value });
            }}
          />

          <Input
            label="UF"
            block
            required
            maxLength={2}
            placeholder="CE"
            value={draft.state}
            error={errors.state}
            inputClassName={styles.upper}
            onChange={(event) => {
              set({ state: event.target.value });
            }}
          />
        </div>

        <div className={styles.pair}>
          <Input
            label="Taxa"
            block
            required
            numeric
            inputMode="decimal"
            prefix="R$"
            placeholder="0,00"
            hint="Zero se a loja entrega sem cobrar."
            value={draft.fee}
            error={errors.fee}
            onChange={(event) => {
              set({ fee: event.target.value });
            }}
          />

          <Input
            label="Prazo"
            block
            numeric
            inputMode="numeric"
            suffix="dias"
            hint="Dias úteis. Zero e no mesmo dia."
            value={draft.days}
            error={errors.days}
            onChange={(event) => {
              set({ days: event.target.value });
            }}
          />
        </div>

        <Input
          label="Frete grátis a partir de"
          block
          numeric
          inputMode="decimal"
          prefix="R$"
          placeholder="regra da loja"
          hint="Em branco, esta cidade segue o mínimo geral que esta em Configurações."
          value={draft.freeFrom}
          error={errors.freeFrom}
          onChange={(event) => {
            set({ freeFrom: event.target.value });
          }}
        />
      </div>
    </Modal>
  );
}

/* ---- A linha de contagem ------------------------------------------------------ */

function summary(cities: readonly AdminDeliveryCity[] | undefined, isPending: boolean): string {
  if (isPending || cities === undefined) {
    return 'Carregando as cidades';
  }

  if (cities.length === 0) {
    return 'Nenhuma cidade cadastrada';
  }

  const active = cities.filter((city) => city.isActive).length;
  const noun = active === 1 ? 'cidade atendida' : 'cidades atendidas';
  const off = cities.length - active;

  return off === 0
    ? `${String(active)} ${noun}`
    : `${String(active)} ${noun}, ${String(off)} fora do checkout`;
}
