import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  ArrowLeftIcon,
  CampaignPreview,
  ConfirmDialog,
  ProductMultiPicker,
  UsesRuler,
} from '@/components/admin';
import {
  Button,
  EmptyState,
  Input,
  Radio,
  RadioGroup,
  Skeleton,
  Switch,
  Textarea,
  useToast,
} from '@/components/ui';
import {
  COUPON_LIMITS,
  announcedCouponId,
  canDeleteForever,
  canManageStore,
  couponChangesOf,
  couponDraftToCreate,
  draftDiscountLabel,
  draftFromCoupon,
  emptyCouponDraft,
  hasCouponErrors,
  maxUsesWarning,
  normalizeCouponCode,
  useAdminRole,
  useCoupon,
  useCoupons,
  useCreateCoupon,
  useDeleteCoupon,
  useUpdateCoupon,
  validateCoupon,
  type AdminCoupon,
  type CouponDraft,
  type DiscountKind,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-coupon-form-page.module.css';

/**
 * O cadastro de uma campanha.
 *
 * ## Uma tela para os dois endereços
 *
 * `/admin/cupons/nova` e `/admin/cupons/:id` são a mesma tela, como em
 * produtos. O que muda e de onde o rascunho nasce — vazio, ou do cupom salvo —
 * e o que o botão faz no fim. O resto e idêntico de propósito: o que a dona
 * aprende criando o primeiro cupom vale quando ela volta para mexer no limite.
 *
 * ## A ordem das seções e a ordem da decisão
 *
 * O código e o desconto primeiro, porque são a campanha: sem eles não há o que
 * cadastrar. O nome e a linha de apoio depois, com a pré-visualização embaixo —
 * são os dois campos que não fazem nada no painel e tudo na home, e escrevê-los
 * no escuro e o que faria a dona publicar para ver. Prazo, limite e produtos
 * vêm em seguida, do mais comum ao mais raro. O anúncio na home fica por
 * último, porque e a decisão que se toma depois de a campanha existir.
 *
 * ## O que não se edita
 *
 * O contador de usos, que e consequência de venda fechada e não configuração —
 * um campo ali seria a possibilidade de zerar um cupom que já deu cinquenta
 * descontos. E o endereço da campanha: o `slug` nasce do nome na criação e não
 * muda mais, porque `/promocao/black-friday` já foi para o story.
 */
export default function AdminCouponFormPage() {
  const { id } = useParams();
  const role = useAdminRole();

  // `/admin/cupons/nova` casa com `:id` — e a mesma rota. O literal e o que
  // separa o cadastro novo da edição, e ele não pode ser um id válido porque
  // `nova` não e hexadecimal de 24 caracteres.
  const isNew = id === undefined || id === 'nova';
  const couponId = isNew ? '' : id;

  const { data: coupon, isPending, isError, error } = useCoupon(couponId);

  usePageMeta({
    title: isNew ? 'Novo cupom — Painel' : `${coupon?.code ?? 'Cupom'} — Painel`,
    description: 'Acesso restrito.',
  });

  if (!canManageStore(role)) {
    return (
      <EmptyState
        as="h1"
        title="Esta área e de quem administra a loja"
        description="Cupom e desconto, e desconto e preço. O seu acesso cobre o atendimento: o início do painel e os pedidos — e o pedido já chega com o desconto aplicado."
        actions={
          <Link to={ROUTES.admin.root} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o início
          </Link>
        }
      />
    );
  }

  if (!isNew && isError) {
    return (
      <EmptyState
        as="h1"
        title="Este cupom não abriu"
        description={errorMessage(error)}
        actions={
          <Link to={ROUTES.admin.coupons} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para os cupons
          </Link>
        }
      />
    );
  }

  if (!isNew && (isPending || coupon === undefined)) {
    return <FormSkeleton />;
  }

  /*
   * A `key` e o que mantem o rascunho fora do alcance das releituras.
   *
   * A lista de cupons se invalida a cada trinta segundos e quando a aba volta
   * ao foco, porque a régua de usos muda do outro lado. Sem a chave, o
   * formulário remontaria os campos a cada releitura e devolveria ao servidor
   * o que estava sendo digitado. Com ela, o rascunho nasce uma vez e só renasce
   * quando o cupom aberto e outro.
   */
  return (
    <CouponForm
      key={coupon?.id ?? 'nova'}
      initial={coupon === undefined ? emptyCouponDraft() : draftFromCoupon(coupon)}
      coupon={coupon ?? null}
      canDelete={canDeleteForever(role)}
    />
  );
}

/* ---- O formulário -------------------------------------------------------- */

function CouponForm({
  initial,
  coupon,
  canDelete,
}: {
  initial: CouponDraft;
  coupon: AdminCoupon | null;
  canDelete: boolean;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const all = useCoupons();
  const create = useCreateCoupon();
  const update = useUpdateCoupon();
  const remove = useDeleteCoupon();

  const [draft, setDraft] = useState<CouponDraft>(initial);
  const [tried, setTried] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isNew = coupon === null;
  const errors = tried ? validateCoupon(draft) : {};
  const warning = maxUsesWarning(draft, coupon);
  const saving = create.isPending || update.isPending;

  // A previsão do anúncio, pela mesma regra do servidor: a home mostra uma
  // campanha por vez. Vale só na edição — um cupom que ainda não existe não
  // disputa a vaga.
  const announced = announcedCouponId(all.data ?? []);
  const inFront = coupon !== null && announced !== null && announced !== coupon.id;

  const set = (patch: Partial<CouponDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const fail = (title: string) => (cause: unknown) => {
    toast({ variant: 'danger', title, description: errorMessage(cause) });
  };

  const submit = (): void => {
    setTried(true);

    if (hasCouponErrors(validateCoupon(draft))) {
      return;
    }

    if (coupon === null) {
      create.mutate(couponDraftToCreate(draft), {
        onSuccess: (created) => {
          toast({
            variant: 'success',
            title: `${created.code} esta cadastrado`,
            description: created.showOnHome
              ? 'A campanha entra na home assim que for a primeira a terminar entre as anunciadas.'
              : 'O código já funciona no fechamento, dentro do prazo cadastrado.',
          });
          void navigate(ROUTES.admin.coupons);
        },
        // A recusa mais comum e "esse código já existe", e a frase do servidor
        // diz o que fazer no lugar: editar o que existe.
        onError: fail('O cupom não foi cadastrado'),
      });

      return;
    }

    const changes = couponChangesOf(draft, coupon);

    // Abrir a campanha para conferir e sair sem mexer em nada e um gesto
    // comum, e ele não gasta uma chamada.
    if (changes === null) {
      void navigate(ROUTES.admin.coupons);

      return;
    }

    update.mutate(
      { id: coupon.id, input: changes },
      {
        onSuccess: (saved) => {
          toast({ variant: 'success', title: `${saved.code} foi salvo` });
          void navigate(ROUTES.admin.coupons);
        },
        onError: fail('O cupom continua como estava'),
      },
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.admin.coupons} className={styles.backLink}>
          <ArrowLeftIcon />
          Cupons
        </Link>

        <h1 className={styles.title}>{isNew ? 'Novo cupom' : coupon.code}</h1>
      </header>

      {/*
        `noValidate`: a validação e a nossa, em português e com as regras do
        servidor. A do navegador apareceria em cima dela, numa bolha que some
        sozinha e que o leitor de tela não anuncia.
      */}
      <form
        noValidate
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Section
          title="O código e o desconto"
          note="O código e o que a cliente digita no fechamento, e o que você dita no WhatsApp: só letras e números, sem espaço e sem acento. O desconto incide sobre os produtos da campanha, nunca sobre o frete."
        >
          <Input
            label="Código"
            block
            required
            className={styles.medium}
            placeholder="BLACKFRIDAY"
            maxLength={COUPON_LIMITS.codeMax}
            autoComplete="off"
            spellCheck={false}
            inputClassName={styles.code}
            hint={`De ${String(COUPON_LIMITS.codeMin)} a ${String(COUPON_LIMITS.codeMax)} caracteres. Vira maiúscula sozinho.`}
            value={draft.code}
            error={errors.code}
            onChange={(event) => {
              set({ code: normalizeCouponCode(event.target.value) });
            }}
          />

          {/*
            Um grupo de duas opções, e não dois campos a preencher. Percentual
            e valor em reais são a mesma decisão vista de dois jeitos, e o
            servidor recusa um cupom com os dois preenchidos — oferecer os dois
            campos abertos convidaria justamente a esse erro.
          */}
          <RadioGroup
            legend="Tipo de desconto"
            name="coupon-discount-kind"
            horizontal
            value={draft.kind}
            onChange={(value) => {
              set({ kind: value as DiscountKind });
            }}
          >
            <Radio value="percent" label="Percentual" description="20% da sacola" />
            <Radio value="amount" label="Valor em reais" description="R$ 30 de abatimento" />
          </RadioGroup>

          {draft.kind === 'percent' ? (
            <Input
              label="Quanto tira"
              block
              required
              numeric
              inputMode="numeric"
              className={styles.short}
              suffix="%"
              placeholder="20"
              hint={`De ${String(COUPON_LIMITS.percentMin)}% a ${String(COUPON_LIMITS.percentMax)}%.`}
              value={draft.percent}
              error={errors.percent}
              onChange={(event) => {
                set({ percent: event.target.value });
              }}
            />
          ) : (
            <Input
              label="Quanto tira"
              block
              required
              numeric
              inputMode="decimal"
              className={styles.medium}
              prefix="R$"
              placeholder="30,00"
              hint="Numa sacola menor que isso, o desconto para no valor dela."
              value={draft.amount}
              error={errors.amount}
              onChange={(event) => {
                set({ amount: event.target.value });
              }}
            />
          )}
        </Section>

        <Section
          title="A campanha"
          note="O nome e a linha de apoio não aparecem no fechamento: são o que a home anuncia e o que a página da campanha mostra."
        >
          <Input
            label="Nome da campanha"
            block
            required
            placeholder="Black Friday Maison"
            maxLength={COUPON_LIMITS.title}
            hint={
              isNew
                ? 'O endereço da campanha nasce deste nome e não muda depois — escolha pensando no link que vai para o story.'
                : `O endereço continua /promocao/${coupon.slug} mesmo que o nome mude: ele já circulou.`
            }
            value={draft.title}
            error={errors.title}
            onChange={(event) => {
              set({ title: event.target.value });
            }}
          />

          <Textarea
            label="Linha de apoio"
            block
            rows={2}
            maxLength={COUPON_LIMITS.tagline}
            placeholder="Os importados que mais saem, com 20% até domingo."
            hint="Opcional. Uma frase curta embaixo do nome, na faixa da home."
            value={draft.tagline}
            error={errors.tagline}
            onChange={(event) => {
              set({ tagline: event.target.value });
            }}
          />

          <CampaignPreview
            title={draft.title.trim()}
            tagline={draft.tagline.trim()}
            discountLabel={draftDiscountLabel(draft)}
            code={draft.code}
            deadline={deadlineOf(draft.endsOn)}
            hasShowcase={draft.productIds.length > 0}
          />
        </Section>

        <Section
          title="Quando vale"
          note="Deixe as duas datas em branco para um código que vale desde já e até você desligar."
        >
          <div className={styles.pair}>
            <Input
              label="Primeiro dia"
              block
              type="date"
              hint="Em branco, começa a valer assim que for salvo."
              value={draft.startsOn}
              onChange={(event) => {
                set({ startsOn: event.target.value });
              }}
            />

            <Input
              label="Último dia"
              block
              type="date"
              hint="O dia inteiro conta. Em branco, fica até ser desligado."
              value={draft.endsOn}
              error={errors.endsOn}
              onChange={(event) => {
                set({ endsOn: event.target.value });
              }}
            />
          </div>
        </Section>

        <Section
          title="Quantos cupons existem"
          note="O limite e o número de vendas que podem usar este código. A conta sobe quando você marca o pedido como Vendido, e um pedido ainda aberto já segura um cupom."
        >
          <Input
            label="Limite de usos"
            block
            numeric
            inputMode="numeric"
            className={styles.medium}
            placeholder="sem limite"
            suffix="cupons"
            hint="Em branco, não há limite."
            value={draft.maxUses}
            error={errors.maxUses}
            onChange={(event) => {
              set({ maxUses: event.target.value });
            }}
          />

          {warning === '' ? null : <output className={styles.warning}>{warning}</output>}

          {/*
            A régua dos números de verdade, e não dos do rascunho. Ela responde
            "quanto desta campanha já foi" enquanto se decide o limite novo, que
            e a única pergunta desta seção.
          */}
          {coupon === null ? null : (
            <div className={styles.ruler}>
              <p className={styles.rulerTitle}>Como esta agora</p>

              <UsesRuler coupon={coupon} variant="full" />
            </div>
          )}
        </Section>

        <Section
          title="Em quais produtos"
          note="Sem nenhum produto escolhido, o cupom vale para a loja inteira. Com produtos escolhidos, o desconto incide só nas linhas deles — e a campanha ganha uma vitrine própria."
        >
          <ProductMultiPicker
            productIds={draft.productIds}
            max={COUPON_LIMITS.products}
            emptyLabel="Nenhum produto escolhido: o desconto vale no catálogo todo."
            error={errors.productIds}
            onChange={(productIds) => {
              set({ productIds });
            }}
          />
        </Section>

        <Section title="No ar e na home">
          <div className={styles.switches}>
            <Switch
              label="Cupom valendo"
              checked={draft.isActive}
              onChange={(event) => {
                set({ isActive: event.target.checked });
              }}
            />

            <p className={styles.switchNote}>
              Desligado, o código deixa de funcionar no fechamento na hora, e o prazo e a conta de
              usos ficam guardados. E o caminho de encerrar uma campanha sem apagar o histórico.
            </p>

            <Switch
              label="Anunciar esta campanha na home"
              checked={draft.showOnHome}
              onChange={(event) => {
                set({ showOnHome: event.target.checked });
              }}
            />

            <p className={styles.switchNote}>
              A home anuncia uma campanha por vez, a que termina primeiro.
              {inFront
                ? ' Hoje há outra campanha na frente desta: ela entra quando a de agora sair do ar.'
                : ' Desligado, a campanha continua valendo para quem tiver o código, e o endereço dela continua abrindo.'}
            </p>
          </div>
        </Section>

        {/*
          Grudada no pé da janela.

          O formulário tem seis seções e rola bastante; um botão de salvar lá
          embaixo obrigaria a percorrer tudo de volta depois de corrigir um
          campo no meio. E e ali, ao lado do botão que acabou de ser apertado,
          que o aviso de erro precisa aparecer.
        */}
        <div className={styles.bar}>
          {tried && hasCouponErrors(errors) ? (
            <p className={styles.barError} role="alert">
              Falta corrigir alguma coisa acima.
            </p>
          ) : null}

          <div className={styles.barActions}>
            {isNew || !canDelete ? null : (
              <Button
                type="button"
                variant="ghost"
                className={styles.delete}
                onClick={() => {
                  setConfirmingDelete(true);
                }}
              >
                Excluir
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                void navigate(ROUTES.admin.coupons);
              }}
            >
              Cancelar
            </Button>

            <Button type="submit" loading={saving} loadingLabel="Salvando">
              {isNew ? 'Cadastrar cupom' : 'Salvar'}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => {
          setConfirmingDelete(false);
        }}
        onConfirm={() => {
          if (coupon === null) {
            return;
          }

          remove.mutate(coupon.id, {
            onSuccess: () => {
              toast({ variant: 'success', title: `${coupon.code} foi excluído` });
              void navigate(ROUTES.admin.coupons);
            },
            onError: (cause) => {
              setConfirmingDelete(false);
              fail('O cupom não foi excluído')(cause);
            },
          });
        }}
        title="Excluir este cupom?"
        description="O histórico vai junto: quantas vendas a campanha fez e quantos cupons ela gastou deixam de existir. Se a ideia e encerrar, desligue o interruptor acima — o código para de valer na hora e a conta fica guardada. Os pedidos já fechados não mudam: eles guardam código, nome e desconto em copia própria."
        target={coupon?.code ?? ''}
        confirmLabel="Excluir o cupom"
        loading={remove.isPending}
      />
    </div>
  );
}

/**
 * Uma seção do formulário.
 *
 * Todas com a mesma medida de 60rem, e as que guardam número curto apertam o
 * próprio campo por dentro. A medida da seção existe pelo mesmo motivo que a
 * do cadastro de produto: um campo de nome esticado na largura da tela e pior
 * de ler do que um de 60rem.
 */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {note === undefined ? null : <p className={styles.sectionNote}>{note}</p>}
      </div>

      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

/** `30/11` a partir do `2026-11-30` do campo. Vazio sem data. */
function deadlineOf(endsOn: string): string {
  if (endsOn === '') {
    return '';
  }

  const [, month, day] = endsOn.split('-');

  return month === undefined || day === undefined ? '' : `${day}/${month}`;
}

function FormSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <Skeleton height="4rem" />
      <Skeleton height="18rem" />
      <Skeleton height="16rem" />
      <Skeleton height="10rem" />
    </div>
  );
}
