import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  ArrowLeftIcon,
  BanIcon,
  ChatIcon,
  CheckIcon,
  ConfirmDialog,
  CopyIcon,
  OrderItems,
} from '@/components/admin';
import { Badge, Button, EmptyState, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import {
  FULFILLMENT_LABELS,
  FULFILLMENT_MODES,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  canSeePrices,
  copyToClipboard,
  statusTone,
  useAdminRole,
  useOrder,
  useSetOrderNotes,
  useSetOrderStatus,
  whatsappLink,
  type AdminOrder,
  type OrderStatus,
} from '@/features/admin';
import { addressLines, formatCents, formatDateTime, formatZipCode } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-order-page.module.css';

/**
 * Um pedido, inteiro.
 *
 * ## O que esta tela e
 *
 * E a tela que fica aberta ao lado do WhatsApp. A dona chega aqui vinda de
 * uma mensagem — "oi, e sobre o ME-260922-K4P1" — e precisa de três coisas
 * na ordem: **o que a pessoa pediu**, **para onde vai**, e **o que eu
 * respondo**. A coluna larga responde a primeira, a coluna estreita responde
 * a segunda, e a fileira de ações no topo responde a terceira.
 *
 * ## Abrir conversa e copiar mensagem são coisas diferentes
 *
 * Parecem o mesmo botão e não são. **Abrir conversa** leva ao WhatsApp com o
 * número e a caixa de texto **vazia**: a dona esta respondendo, e mandar o
 * pedido de volta para quem acabou de manda-lo seria estranho. **Copiar
 * mensagem** põe o texto do pedido na área de transferência, para quando ela
 * precisa reenviar — o cliente apagou a conversa, ou quer repassar para
 * quem vai retirar.
 *
 * ## O cancelamento e a única ação que não volta
 *
 * O seletor de status move o pedido livremente, e de propósito: um pedido
 * pago no balção pula para entregue, um que voltou dos Correios volta para
 * preparando. O backend não tem máquina de estados porque a vida da loja não
 * tem.
 *
 * O cancelamento e outra coisa. Ele devolve o estoque das variantes e não
 * pode ser desfeito — o servidor recusa com 409 qualquer status depois dele.
 * Por isso ele não esta no seletor: e um botão próprio, vermelho, com
 * confirmação que nomeia o código do pedido. Esconde-lo do seletor e o que
 * impede o gesto de "mudar o status" de, num deslize, devolver estoque.
 *
 * ## O que o STAFF vê
 *
 * O pedido inteiro, sem um número de dinheiro: nem preço unitário, nem total
 * de linha, nem o resumo de valores. Ele move status, anota e abre a
 * conversa — que e o trabalho dele.
 */
export default function AdminOrderPage() {
  const { id = '' } = useParams();
  const role = useAdminRole();
  const { data: order, isPending, isError, error } = useOrder(id);

  usePageMeta({
    title: order ? `${order.code} — Painel` : 'Pedido — Painel',
    description: 'Acesso restrito.',
  });

  if (isError) {
    return (
      <EmptyState
        as="h1"
        title="Este pedido não abriu"
        description={errorMessage(error)}
        actions={
          <Link to={ROUTES.admin.orders} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para os pedidos
          </Link>
        }
      />
    );
  }

  if (isPending || order === undefined) {
    return <OrderSkeleton />;
  }

  return <Order order={order} showPrices={canSeePrices(role)} />;
}

/* ---- O pedido ------------------------------------------------------------ */

function Order({ order, showPrices }: { order: AdminOrder; showPrices: boolean }) {
  const isCancelled = order.status === ORDER_STATUSES.CANCELLED;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.admin.orders} className={styles.backLink}>
          <ArrowLeftIcon />
          Pedidos
        </Link>

        <div className={styles.identity}>
          <h1 className={styles.code}>{order.code}</h1>

          <Badge variant={statusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>

        <p className={styles.when}>
          Fechado em <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
          {order.updatedAt === order.createdAt ? null : (
            <> · atualizado em {formatDateTime(order.updatedAt)}</>
          )}
        </p>
      </header>

      <QuickActions order={order} isCancelled={isCancelled} />

      <div className={styles.columns}>
        <div className={styles.main}>
          <Panel title={`Itens (${String(order.items.length)})`}>
            <OrderItems items={order.items} showPrices={showPrices} />
          </Panel>

          <Panel
            title="Mensagem enviada"
            note="E o texto que saiu para o WhatsApp quando o pedido fechou. Guardado como foi mandado."
          >
            <pre className={styles.message}>{order.whatsappMessage}</pre>
          </Panel>

          <Notes order={order} />
        </div>

        <div className={styles.rail}>
          <Panel title="Status">
            <StatusPicker order={order} isCancelled={isCancelled} />
          </Panel>

          <Panel title="Cliente">
            <dl className={styles.facts}>
              <Fact label="Nome" value={order.customer.name} />

              <div className={styles.fact}>
                <dt>WhatsApp</dt>
                <dd>
                  <a
                    href={whatsappLink(order.customer.phone)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={styles.phone}
                  >
                    <ChatIcon className={styles.phoneIcon} />
                    {order.customer.phoneLabel}
                  </a>
                </dd>
              </div>

              {order.customer.email === '' ? null : (
                <Fact label="E-mail" value={order.customer.email} />
              )}
            </dl>
          </Panel>

          <Panel title="Entrega">
            <Fulfillment order={order} />
          </Panel>

          <Panel title="Pagamento">
            <dl className={styles.facts}>
              <Fact label="Forma" value={PAYMENT_LABELS[order.payment.method]} />

              {order.payment.method === PAYMENT_METHODS.CARD ? (
                <Fact
                  label="Parcelas"
                  value={
                    order.payment.installments <= 1
                      ? 'A vista'
                      : `${String(order.payment.installments)}x ${
                          order.payment.hasInterest ? 'com juros' : 'sem juros'
                        }`
                  }
                />
              ) : null}
            </dl>
          </Panel>

          {showPrices ? <Totals order={order} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ---- As ações rápidas ----------------------------------------------------- */

/**
 * A fileira que fica ao alcance do polegar, acima de tudo.
 *
 * As três ações que a dona faz nesta tela, na ordem em que ela as faz:
 * responder, reenviar, desistir. O cancelamento fica separado a direita, e
 * não ao lado das outras duas — a distância e o que impede o dedo de errar
 * o alvo no celular.
 */
function QuickActions({ order, isCancelled }: { order: AdminOrder; isCancelled: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const setStatus = useSetOrderStatus();

  // O "copiado" volta ao normal sozinho. Dois segundos e o bastante para a
  // confirmação ser vista sem que o botão fique preso no estado de sucesso.
  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const copy = async (): Promise<void> => {
    const ok = await copyToClipboard(order.whatsappMessage);

    if (ok) {
      setCopied(true);
      return;
    }

    // `navigator.clipboard` não existe em contexto inseguro — e o painel
    // aberto por IP na rede da loja e um contexto inseguro. Em vez de um
    // erro mudo, a tela aponta o caminho manual: a mensagem esta na página,
    // selecionável.
    toast({
      variant: 'danger',
      title: 'Não consegui copiar',
      description: 'Selecione o texto em "Mensagem enviada" e copie pelo teclado.',
    });
  };

  const cancel = (): void => {
    setStatus.mutate(
      { id: order.id, status: ORDER_STATUSES.CANCELLED },
      {
        onSuccess: () => {
          setConfirming(false);
          toast({
            variant: 'success',
            title: `${order.code} cancelado`,
            description: 'As unidades voltaram para o estoque.',
          });
        },
        onError: (error) => {
          setConfirming(false);
          toast({
            variant: 'danger',
            title: 'Não deu para cancelar',
            description: errorMessage(error),
          });
        },
      },
    );
  };

  return (
    <div className={styles.actions}>
      {/*
        Um `<a>`, e nao um `<Button>` com `window.open`.

        E a unica acao desta tela que sai da aplicacao, e so o link abre em
        nova aba com o meio do mouse — que e exatamente como a dona trabalha:
        a conversa de um lado, o painel do outro. Um botao com `window.open`
        parece igual, tira essa possibilidade e ainda e anunciado como
        "botao" por quem ouve a tela.
      */}
      <a
        href={whatsappLink(order.customer.phone)}
        target="_blank"
        rel="noreferrer noopener"
        className={styles.openChat}
      >
        <ChatIcon />
        Abrir conversa
      </a>

      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          void copy();
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
      </Button>

      {isCancelled ? null : (
        <Button
          type="button"
          variant="ghost"
          className={styles.cancel}
          onClick={() => {
            setConfirming(true);
          }}
        >
          <BanIcon />
          Cancelar pedido
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
        onConfirm={cancel}
        title="Cancelar este pedido?"
        description="As unidades voltam para o estoque e o pedido não pode mais mudar de status. O cliente vê o cancelamento na conta dele."
        target={order.code}
        confirmLabel="Cancelar o pedido"
        loading={setStatus.isPending}
      />
    </div>
  );
}

/* ---- O seletor de status --------------------------------------------------- */

function StatusPicker({ order, isCancelled }: { order: AdminOrder; isCancelled: boolean }) {
  const { toast } = useToast();
  const setStatus = useSetOrderStatus();

  if (isCancelled) {
    return (
      <p className={styles.finalNote}>
        Pedido cancelado
        {order.stockRestoredAt === null
          ? '.'
          : `, com o estoque devolvido em ${formatDateTime(order.stockRestoredAt)}.`}{' '}
        Um pedido cancelado não volta atrás — se a venda for retomada, feche um pedido novo.
      </p>
    );
  }

  const move = (status: OrderStatus): void => {
    setStatus.mutate(
      { id: order.id, status },
      {
        onSuccess: () => {
          toast({
            variant: 'success',
            title: `${order.code}: ${ORDER_STATUS_LABELS[status]}`,
            description: 'O cliente vê o novo status na conta dele.',
          });
        },
        onError: (error) => {
          toast({
            variant: 'danger',
            title: 'O status não mudou',
            description: errorMessage(error),
          });
        },
      },
    );
  };

  return (
    <>
      <Select
        label="Situação do pedido"
        block
        value={order.status}
        disabled={setStatus.isPending}
        // O cancelamento sai da lista: ele devolve estoque e não volta atrás,
        // e uma ação assim não pertence a um menu onde se escolhe por
        // aproximação. Ele e o botão vermelho lá em cima.
        options={ORDER_STATUS_OPTIONS.filter((option) => option.value !== ORDER_STATUSES.CANCELLED)}
        onChange={(event) => {
          move(event.target.value as OrderStatus);
        }}
      />

      <p className={styles.statusHint}>
        Muda na hora, e na mesma hora aparece na conta do cliente.
      </p>
    </>
  );
}

/* ---- A entrega -------------------------------------------------------------- */

function Fulfillment({ order }: { order: AdminOrder }) {
  const { fulfillment } = order;
  const isPickup = fulfillment.mode === FULFILLMENT_MODES.PICKUP;

  return (
    <dl className={styles.facts}>
      <Fact label="Modo" value={FULFILLMENT_LABELS[fulfillment.mode]} />

      {fulfillment.cityName === '' ? null : (
        <Fact
          label="Cidade"
          value={
            fulfillment.state === ''
              ? fulfillment.cityName
              : `${fulfillment.cityName}/${fulfillment.state}`
          }
        />
      )}

      {fulfillment.estimatedDays > 0 ? (
        <Fact
          label="Prazo"
          value={
            fulfillment.estimatedDays === 1
              ? '1 dia útil'
              : `${String(fulfillment.estimatedDays)} dias úteis`
          }
        />
      ) : null}

      {isPickup || fulfillment.address === null ? (
        // Na retirada não há endereço a preencher, e dizer isso e melhor do
        // que deixar a coluna terminar sem explicação.
        <div className={styles.fact}>
          <dt>Endereço</dt>
          <dd className={styles.pickup}>A cliente retira na loja.</dd>
        </div>
      ) : (
        <div className={styles.fact}>
          <dt>Endereço</dt>
          <dd>
            {/*
              Escrito como etiqueta de correspondencia, que e o formato que
              alguem consegue ler em voz alta pelo telefone e digitar num
              aplicativo de mapa.
            */}
            <address className={styles.address}>
              {addressLines({
                ...fulfillment.address,
                city: fulfillment.cityName,
                state: fulfillment.state,
              }).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>

            {fulfillment.address.reference === '' ? null : (
              <p className={styles.reference}>Referência: {fulfillment.address.reference}</p>
            )}
          </dd>
        </div>
      )}

      {fulfillment.address === null || fulfillment.address.zipCode === '' ? null : (
        <Fact label="CEP" value={formatZipCode(fulfillment.address.zipCode)} />
      )}
    </dl>
  );
}

/* ---- Os valores -------------------------------------------------------------- */

function Totals({ order }: { order: AdminOrder }) {
  const { totals } = order;

  return (
    <Panel title="Valores">
      <dl className={styles.totals}>
        <Money label="Subtotal" cents={totals.subtotalCents} />

        {totals.discountTotalCents > 0 ? (
          <Money label="Descontos" cents={-totals.discountTotalCents} />
        ) : null}

        {totals.deliveryFeeCents > 0 ? (
          <Money label="Entrega" cents={totals.deliveryFeeCents} />
        ) : null}

        {totals.pixDiscountCents > 0 ? (
          <Money label="Desconto do PIX" cents={-totals.pixDiscountCents} />
        ) : null}

        <div className={styles.grandTotal}>
          <dt>Total</dt>
          <dd className="tabular">{formatCents(totals.totalCents)}</dd>
        </div>
      </dl>
    </Panel>
  );
}

/* ---- A anotação interna --------------------------------------------------------- */

/**
 * A conversa da loja sobre o pedido.
 *
 * Nunca sai daqui: a rota do cliente devolve o pedido sem este campo. E onde
 * fica "combinou de pagar na entrega" e "já atrasou duas vezes, confirmar
 * antes de sair" — e e por isso que vale o aviso escrito na tela, para que
 * ninguém escreva aqui achando que o cliente lê.
 *
 * O botão só acorda quando o texto muda. Salvar o mesmo texto de novo e uma
 * escrita a toa no banco e um "salvo!" que não significa nada.
 */
function Notes({ order }: { order: AdminOrder }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(order.notes);
  const [known, setKnown] = useState(order.notes);
  const save = useSetOrderNotes();

  // A anotação pode chegar diferente do servidor — outra aba escreveu, ou a
  // consulta revalidou depois de salvar. Ajustada durante o render, e não num
  // efeito: um efeito pintaria o texto antigo primeiro e o trocaria no quadro
  // seguinte, e o campo piscaria. `known` guarda o último valor que veio de
  // lá, e a comparação só dispara quando ele realmente muda.
  if (order.notes !== known) {
    setKnown(order.notes);
    setDraft(order.notes);
  }

  const dirty = draft !== order.notes;

  return (
    <Panel title="Anotações internas" note="Só a equipe vê. O cliente nunca recebe este texto.">
      <Textarea
        label="Anotações do pedido"
        hideLabel
        block
        rows={4}
        maxLength={2000}
        placeholder="Combinado com a cliente, o que ficou pendente, o que conferir antes de sair."
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />

      <div className={styles.noteActions}>
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(order.notes);
            }}
          >
            Descartar
          </Button>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          disabled={!dirty}
          loading={save.isPending}
          loadingLabel="Salvando"
          onClick={() => {
            save.mutate(
              { id: order.id, notes: draft },
              {
                onSuccess: () => {
                  toast({ variant: 'success', title: 'Anotação salva' });
                },
                onError: (error) => {
                  toast({
                    variant: 'danger',
                    title: 'A anotação não foi salva',
                    description: errorMessage(error),
                  });
                },
              },
            );
          }}
        >
          Salvar anotação
        </Button>
      </div>
    </Panel>
  );
}

/* ---- As peças repetidas ---------------------------------------------------------- */

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {note === undefined ? null : <p className={styles.panelNote}>{note}</p>}
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Money({ label, cents }: { label: string; cents: number }) {
  return (
    <div className={styles.money}>
      <dt>{label}</dt>
      <dd className="tabular">{formatCents(cents)}</dd>
    </div>
  );
}

/**
 * O esqueleto tem a forma que vai chegar.
 *
 * As duas colunas nas alturas de verdade: quando a resposta chega, nada
 * salta de lugar.
 */
function OrderSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <Skeleton height="4.5rem" />
      <Skeleton height="3rem" />

      <div className={styles.columns}>
        <div className={styles.main}>
          <Skeleton height="18rem" />
          <Skeleton height="12rem" />
        </div>

        <div className={styles.rail}>
          <Skeleton height="9rem" />
          <Skeleton height="11rem" />
          <Skeleton height="14rem" />
        </div>
      </div>
    </div>
  );
}
