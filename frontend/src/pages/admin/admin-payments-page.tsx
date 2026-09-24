import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AlertIcon, ArrowLeftIcon, PaymentPreview } from '@/components/admin';
import {
  Button,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Switch,
  useToast,
  type SelectOption,
} from '@/components/ui';
import {
  PAYMENT_LIMITS,
  PIX_KEY_LABELS,
  PIX_KEY_PLACEHOLDERS,
  canManageStore,
  draftFromPaymentSettings,
  hasPaymentErrors,
  isPaymentDirty,
  paymentChangesOf,
  pixPreview,
  previewCard,
  useAdminPaymentSettings,
  useAdminRole,
  useSavePaymentSettings,
  validatePayment,
  paymentWarningsOf,
  type AdminPaymentSettings,
  type PaymentDraft,
  type PaymentWarning,
} from '@/features/admin';
import type { PixKeyType } from '@/features/payments';
import { centsFromInput, formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-payments-page.module.css';

/**
 * As regras de pagamento da loja.
 *
 * ## Esta tela não processa pagamento nenhum
 *
 * Nada aqui cobra: a cliente paga por fora — PIX no aplicativo do banco,
 * cartão na maquininha ou no link que a dona manda. O que se decide nesta
 * tela e o que o checkout **anuncia**, e e por isso que cada número daqui
 * vale dinheiro: e a promessa que a loja faz antes de combinar a cobrança.
 *
 * ## Por que há botão de salvar, ao contrário da tela de entrega
 *
 * Na tabela de taxas cada campo grava ao sair dele, porque lá a dona esta
 * reajustando cinco cidades e conferindo uma contra a outra. Aqui e o
 * oposto: são seis números que se afetam, e a pergunta não e "quanto custa"
 * e sim "como fica a lista". A prévia ao lado responde isso enquanto se
 * digita — e responder antes de gravar só tem sentido se gravar for um
 * segundo passo.
 *
 * ## A prévia mostra o que ainda não vale
 *
 * E o risco desta tela: a lista ao lado muda na hora e parece já estar no
 * ar. Por isso a barra de salvar não diz só "Salvar" — ela diz que as
 * mudancas ainda não valem para quem esta comprando agora.
 *
 * ## O que o STAFF vê
 *
 * Nada. A chave PIX e o endereço para onde vai o dinheiro da loja, e o
 * backend recusa inclusive a leitura.
 */
export default function AdminPaymentsPage() {
  const role = useAdminRole();
  const { data: settings, isPending, isError, error } = useAdminPaymentSettings();

  usePageMeta({ title: 'Pagamento — Painel', description: 'Acesso restrito.' });

  if (!canManageStore(role)) {
    return (
      <EmptyState
        as="h1"
        title="Esta área e de quem administra a loja"
        description="As regras de pagamento incluem a chave PIX da loja. O seu acesso cobre o atendimento: o início do painel e os pedidos — e o pedido já mostra como cada cliente escolheu pagar."
        actions={
          <Link to={ROUTES.admin.root} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o início
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Pagamento</h1>

        <p className={styles.subtitle}>
          {settings === undefined
            ? 'Como a loja recebe, e o que o checkout anuncia.'
            : `Alterado pela última vez em ${formatDateTime(settings.updatedAt)}.`}
        </p>
      </header>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : isPending ? (
        <div className={styles.skeleton} aria-busy="true">
          <Skeleton height="18rem" />
          <Skeleton height="18rem" />
        </div>
      ) : (
        <PaymentForm settings={settings} />
      )}
    </div>
  );
}

/* ---- O formulário ------------------------------------------------------------- */

/** R$ 300: a faixa da maioria dos pedidos, e o valor que o plano pede. */
const DEFAULT_PREVIEW_AMOUNT = '300,00';

function PaymentForm({ settings }: { settings: AdminPaymentSettings }) {
  const { toast } = useToast();
  const save = useSavePaymentSettings();

  const [draft, setDraft] = useState<PaymentDraft>(() => draftFromPaymentSettings(settings));
  const [touched, setTouched] = useState(false);
  const [amount, setAmount] = useState(DEFAULT_PREVIEW_AMOUNT);

  const errors = touched ? validatePayment(draft) : {};
  const changes = paymentChangesOf(draft, settings);
  const dirty = isPaymentDirty(draft, settings);
  const warnings = paymentWarningsOf(draft);
  const amountCents = centsFromInput(amount);

  const set = (patch: Partial<PaymentDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = (): void => {
    setTouched(true);

    if (changes === null || hasPaymentErrors(validatePayment(draft))) {
      return;
    }

    save.mutate(changes, {
      onSuccess: (saved) => {
        // O servidor devolve a chave normalizada — `+5588...` onde foi
        // digitado `(88) 9...`. Reabrir o rascunho com a resposta e o que faz
        // o campo mostrar o que esta gravado, e não o que foi enviado.
        setDraft(draftFromPaymentSettings(saved));
        setTouched(false);
        toast({
          variant: 'success',
          title: 'As regras de pagamento valem a partir de agora',
          description: 'O próximo pedido já e calculado por elas.',
        });
      },
      onError: (cause) => {
        toast({
          variant: 'danger',
          title: 'Nada foi alterado',
          description: errorMessage(cause),
        });
      },
    });
  };

  return (
    <>
      <div className={styles.layout}>
        <div className={styles.form}>
          {warnings
            .filter((warning) => warning.scope === 'store')
            .map((warning) => (
              <Warning key={warning.text} warning={warning} />
            ))}

          <section className={styles.card} aria-labelledby="secao-pix">
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle} id="secao-pix">
                PIX
              </h2>

              <Switch
                label="Aceitar PIX"
                checked={draft.acceptsPix}
                onChange={(event) => {
                  set({ acceptsPix: event.target.checked });
                }}
              />
            </div>

            <p className={styles.cardHint}>
              A chave nunca aparece na vitrine: a cliente só a recebe no fim do pedido, junto do
              valor e do nome do titular.
            </p>

            <div className={styles.fields}>
              <Select
                label="Tipo da chave"
                block
                options={PIX_KEY_TYPE_OPTIONS}
                value={draft.pixKeyType}
                onChange={(event) => {
                  set({ pixKeyType: event.target.value as PixKeyType });
                }}
              />

              <Input
                label="Chave PIX"
                block
                maxLength={PAYMENT_LIMITS.pixKeyLength}
                placeholder={PIX_KEY_PLACEHOLDERS[draft.pixKeyType]}
                hint="E para onde o dinheiro vai. Confira digito por digito."
                value={draft.pixKey}
                error={errors.pixKey}
                onChange={(event) => {
                  set({ pixKey: event.target.value });
                }}
              />

              <Input
                label="Desconto no PIX"
                block
                numeric
                inputMode="numeric"
                suffix="%"
                placeholder="0"
                hint="Só sobre os produtos. A entrega nunca entra no desconto."
                value={draft.pixDiscount}
                error={errors.pixDiscount}
                onChange={(event) => {
                  set({ pixDiscount: event.target.value });
                }}
              />
            </div>

            {warnings
              .filter((warning) => warning.scope === 'pix')
              .map((warning) => (
                <Warning key={warning.text} warning={warning} />
              ))}
          </section>

          <section className={styles.card} aria-labelledby="secao-cartao">
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle} id="secao-cartao">
                Cartão
              </h2>

              <Switch
                label="Aceitar cartão"
                checked={draft.acceptsCard}
                onChange={(event) => {
                  set({ acceptsCard: event.target.checked });
                }}
              />
            </div>

            <p className={styles.cardHint}>
              A loja não passa o cartão pelo sistema: estas regras são a conta que o checkout mostra
              antes de a cobrança ser combinada.
            </p>

            <div className={styles.fields}>
              <div className={styles.pair}>
                <Select
                  label="Parcelar em até"
                  block
                  options={INSTALLMENT_OPTIONS}
                  value={draft.maxInstallments}
                  error={errors.maxInstallments}
                  onChange={(event) => {
                    set({ maxInstallments: event.target.value });
                  }}
                />

                <Select
                  label="Sem juros até"
                  block
                  // As opções acima do máximo ficam desabilitadas em vez de
                  // sumirem: some-las faria o campo mudar de tamanho a cada
                  // troca do máximo, e esconderia o porque de 12 não estar lá.
                  options={interestFreeOptions(draft.maxInstallments)}
                  value={draft.interestFreeUpTo}
                  error={errors.interestFreeUpTo}
                  onChange={(event) => {
                    set({ interestFreeUpTo: event.target.value });
                  }}
                />
              </div>

              <div className={styles.pair}>
                <Input
                  label="Juros ao mês"
                  block
                  numeric
                  inputMode="decimal"
                  suffix="%"
                  placeholder="0,00"
                  hint="1,99 e o que a maquininha costuma cobrar."
                  value={draft.monthlyInterest}
                  error={errors.monthlyInterest}
                  onChange={(event) => {
                    set({ monthlyInterest: event.target.value });
                  }}
                />

                <Input
                  label="Parcela mínima"
                  block
                  numeric
                  inputMode="decimal"
                  prefix="R$"
                  placeholder="0,00"
                  hint="Abaixo disto a opção não e oferecida. Zero tira a regra."
                  value={draft.minInstallment}
                  error={errors.minInstallment}
                  onChange={(event) => {
                    set({ minInstallment: event.target.value });
                  }}
                />
              </div>
            </div>

            {warnings
              .filter((warning) => warning.scope === 'card')
              .map((warning) => (
                <Warning key={warning.text} warning={warning} />
              ))}
          </section>
        </div>

        <PaymentPreview
          amount={amount}
          amountCents={amountCents}
          onAmountChange={setAmount}
          pix={amountCents === null ? null : pixPreview(draft, amountCents)}
          card={previewCard(draft)}
        />
      </div>

      {dirty ? (
        <div className={styles.bar}>
          <p className={styles.barText} aria-live="polite">
            <strong className={styles.barTitle}>Alterações ainda não salvas.</strong> Quem esta
            comprando agora continua vendo as regras antigas.
          </p>

          <div className={styles.barActions}>
            <Button
              type="button"
              variant="secondary"
              disabled={save.isPending}
              onClick={() => {
                setDraft(draftFromPaymentSettings(settings));
                setTouched(false);
              }}
            >
              Descartar
            </Button>

            <Button type="button" onClick={submit} loading={save.isPending} loadingLabel="Salvando">
              Salvar
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---- Os avisos ----------------------------------------------------------------- */

/**
 * O que o servidor aceita e provavelmente não era a intenção.
 *
 * Aviso, e não erro: não bloqueia, não usa vermelho e não pede confirmação. A
 * loja pode mesmo querer ficar sem cartão por uma semana — o que ela não pode
 * e ficar sem saber que ficou.
 */
function Warning({ warning }: { warning: PaymentWarning }) {
  return (
    <p className={styles.warning}>
      <AlertIcon />
      {warning.text}
    </p>
  );
}

/* ---- As opções dos seletores ---------------------------------------------------- */

const PIX_KEY_TYPE_OPTIONS = (Object.keys(PIX_KEY_LABELS) as PixKeyType[]).map((type) => ({
  value: type,
  label: PIX_KEY_LABELS[type],
}));

/**
 * De 1 a 24, como o servidor aceita.
 *
 * Um seletor e não um campo numérico: são vinte e quatro valores possíveis e
 * nenhum outro, e um `<input type="number">` deixaria digitar 36 para ouvir um
 * não depois. No celular também e a diferença entre a roda do sistema e um
 * teclado numérico inteiro para escolher um número de dois digitos.
 */
const INSTALLMENT_OPTIONS = Array.from({ length: PAYMENT_LIMITS.installments }, (_, index) => {
  const count = index + 1;

  return { value: String(count), label: count === 1 ? 'A vista' : `${String(count)}x` };
});

/**
 * As mesmas opções, com as que passam do máximo desabilitadas.
 *
 * Desabilitadas e não removidas: some-las faria a lista encurtar e alongar a
 * cada troca do máximo, e esconderia o motivo de 12 não estar lá. O servidor
 * recusa o par com 422, e a validação da tela diz a mesma coisa em palavras
 * para quem chegar ali pelo teclado.
 */
function interestFreeOptions(maxInstallments: string): SelectOption[] {
  const max = Number(maxInstallments);

  return INSTALLMENT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    disabled: Number.isInteger(max) && Number(option.value) > max,
  }));
}
