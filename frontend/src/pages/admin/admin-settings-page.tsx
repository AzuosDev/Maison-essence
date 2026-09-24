import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AlertIcon, ArrowLeftIcon, BannerEditor, PagesEditor } from '@/components/admin';
import { Button, EmptyState, Input, Skeleton, Switch, Textarea, useToast } from '@/components/ui';
import {
  SETTINGS_LIMITS,
  canManageStore,
  draftFromStoreSettings,
  hasSettingsErrors,
  isSettingsDirty,
  settingsChangesOf,
  settingsWarningsOf,
  useAdminRole,
  useAdminSettings,
  useSaveSettings,
  validateSettings,
  type AddressDraft,
  type AdminStoreSettings,
  type SettingsDraft,
  type SettingsWarning,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-settings-page.module.css';

/**
 * As configuracoes da loja.
 *
 * ## Cinco assuntos, uma tela, um botao
 *
 * Nome da loja, retirada, redes, carrossel e paginas moram no mesmo documento
 * e sao gravados pelo mesmo `PATCH`. Poderiam ser cinco telas, e nao sao: a
 * dona vem aqui uma vez a cada tantas semanas, quase sempre para mexer em uma
 * coisa so — e descobrir *qual das cinco telas* tem a barra de avisos custa
 * mais do que rolar uma pagina.
 *
 * ## O que so se descobre depois
 *
 * Tres configuracoes desta tela sao aceitas pelo servidor e somem do site sem
 * dizer nada: loja sem WhatsApp (o pedido fechado no checkout nao tem para
 * onde ir), retirada ligada sem endereco, e pagina publicada sem texto. As
 * tres viram aviso escrito, no bloco onde foram causadas.
 *
 * ## O que o STAFF ve
 *
 * Nada. Daqui se muda o numero para onde vai todo pedido da loja, e o backend
 * recusa inclusive a leitura.
 */
export default function AdminSettingsPage() {
  const role = useAdminRole();
  const { data: settings, isPending, isError, error } = useAdminSettings();

  usePageMeta({ title: 'Configuracoes — Painel', description: 'Acesso restrito.' });

  if (!canManageStore(role)) {
    return (
      <EmptyState
        as="h1"
        title="Esta area e de quem administra a loja"
        description="Daqui se muda o numero para onde vai todo pedido, o que a loja anuncia e o que ela publica. O seu acesso cobre o atendimento: o inicio do painel e os pedidos."
        actions={
          <Link to={ROUTES.admin.root} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o inicio
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configuracoes</h1>

        <p className={styles.subtitle}>
          O que a loja diz de si: o nome, o contato, o que a home mostra primeiro e as paginas que o
          rodape lista.
        </p>
      </header>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : isPending ? (
        <div className={styles.skeleton} aria-busy="true">
          <Skeleton height="16rem" />
          <Skeleton height="16rem" />
        </div>
      ) : (
        <SettingsForm settings={settings} />
      )}
    </div>
  );
}

/* ---- O formulario ------------------------------------------------------------- */

function SettingsForm({ settings }: { settings: AdminStoreSettings }) {
  const { toast } = useToast();
  const save = useSaveSettings();

  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromStoreSettings(settings));
  const [touched, setTouched] = useState(false);

  const errors = touched ? validateSettings(draft, settings) : {};
  const warnings = settingsWarningsOf(draft);
  const dirty = isSettingsDirty(draft, settings);

  const set = (patch: Partial<SettingsDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const setAddress = (patch: Partial<AddressDraft>): void => {
    setDraft((current) => ({ ...current, pickupAddress: { ...current.pickupAddress, ...patch } }));
  };

  const submit = (): void => {
    setTouched(true);

    const changes = settingsChangesOf(draft, settings);

    if (changes === null || hasSettingsErrors(validateSettings(draft, settings))) {
      return;
    }

    save.mutate(changes, {
      onSuccess: (saved) => {
        // O servidor devolve tudo normalizado — o numero so com digitos, a
        // sigla em maiuscula — e os banners novos ja com os seus `id`. Sem
        // reabrir o rascunho com a resposta, o proximo salvamento mandaria os
        // banners de novo sem `id` e criaria copias deles.
        setDraft(draftFromStoreSettings(saved));
        setTouched(false);
        toast({
          variant: 'success',
          title: 'A loja ja esta assim',
          description: 'Quem abrir o site agora ve as configuracoes novas.',
        });
      },
      onError: (cause) => {
        toast({ variant: 'danger', title: 'Nada foi alterado', description: errorMessage(cause) });
      },
    });
  };

  return (
    <>
      <div className={styles.form}>
        <section className={styles.card} aria-labelledby="secao-loja">
          <h2 className={styles.cardTitle} id="secao-loja">
            A loja
          </h2>

          <Warnings warnings={warnings} scope="store" />

          <div className={styles.fields}>
            <div className={styles.pair}>
              <Input
                label="Nome da loja"
                block
                required
                maxLength={SETTINGS_LIMITS.storeName}
                hint="Aparece no cabecalho, no titulo da aba e na mensagem do pedido."
                value={draft.storeName}
                error={errors.storeName}
                onChange={(event) => {
                  set({ storeName: event.target.value });
                }}
              />

              <Input
                label="WhatsApp"
                block
                inputMode="tel"
                placeholder="(88) 99999-9999"
                hint="E para este numero que todo pedido fechado no site e enviado."
                value={draft.whatsapp}
                error={errors.whatsapp}
                onChange={(event) => {
                  set({ whatsapp: event.target.value });
                }}
              />
            </div>

            <div className={styles.pair}>
              <Input
                label="E-mail de contato"
                block
                type="email"
                maxLength={SETTINGS_LIMITS.contactEmail}
                placeholder="contato@maisonessence.com.br"
                value={draft.contactEmail}
                error={errors.contactEmail}
                onChange={(event) => {
                  set({ contactEmail: event.target.value });
                }}
              />

              <Input
                label="Horario de atendimento"
                block
                maxLength={SETTINGS_LIMITS.businessHours}
                placeholder="Seg a Sex, 9h as 18h"
                hint="Texto livre, como a cliente le no rodape."
                value={draft.businessHours}
                error={errors.businessHours}
                onChange={(event) => {
                  set({ businessHours: event.target.value });
                }}
              />
            </div>

            <Input
              label="Barra de avisos"
              block
              maxLength={SETTINGS_LIMITS.announcementText}
              placeholder="Frete gratis acima de R$ 200"
              hint="A faixa no topo de toda pagina. Em branco, a faixa nao aparece."
              value={draft.announcementText}
              error={errors.announcementText}
              onChange={(event) => {
                set({ announcementText: event.target.value });
              }}
            />

            <Input
              label="Frete gratis a partir de"
              block
              numeric
              inputMode="decimal"
              prefix="R$"
              placeholder="sem minimo geral"
              hint="Vale em qualquer cidade. A cidade que tiver regra propria, em Entrega, ignora esta."
              value={draft.freeShippingMin}
              error={errors.freeShippingMin}
              onChange={(event) => {
                set({ freeShippingMin: event.target.value });
              }}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="secao-retirada">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle} id="secao-retirada">
              Retirada na loja
            </h2>

            <Switch
              label="Oferecer retirada"
              checked={draft.pickupEnabled}
              onChange={(event) => {
                set({ pickupEnabled: event.target.checked });
              }}
            />
          </div>

          <p className={styles.cardHint}>
            Com a retirada ligada, o checkout oferece a opcao sem taxa e mostra este endereco depois
            que o pedido e fechado.
          </p>

          <Warnings warnings={warnings} scope="pickup" />

          <div className={styles.fields}>
            <div className={styles.street}>
              <Input
                label="Rua"
                block
                maxLength={SETTINGS_LIMITS.street}
                value={draft.pickupAddress.street}
                error={errors.address?.street}
                onChange={(event) => {
                  setAddress({ street: event.target.value });
                }}
              />

              <Input
                label="Numero"
                block
                maxLength={SETTINGS_LIMITS.number}
                value={draft.pickupAddress.number}
                error={errors.address?.number}
                onChange={(event) => {
                  setAddress({ number: event.target.value });
                }}
              />
            </div>

            <div className={styles.pair}>
              <Input
                label="Complemento"
                block
                maxLength={SETTINGS_LIMITS.complement}
                placeholder="Sala 2"
                value={draft.pickupAddress.complement}
                error={errors.address?.complement}
                onChange={(event) => {
                  setAddress({ complement: event.target.value });
                }}
              />

              <Input
                label="Bairro"
                block
                maxLength={SETTINGS_LIMITS.district}
                value={draft.pickupAddress.district}
                error={errors.address?.district}
                onChange={(event) => {
                  setAddress({ district: event.target.value });
                }}
              />
            </div>

            <div className={styles.city}>
              <Input
                label="Cidade"
                block
                maxLength={SETTINGS_LIMITS.city}
                value={draft.pickupAddress.city}
                error={errors.address?.city}
                onChange={(event) => {
                  setAddress({ city: event.target.value });
                }}
              />

              <Input
                label="UF"
                block
                maxLength={2}
                inputClassName={styles.upper}
                value={draft.pickupAddress.state}
                error={errors.address?.state}
                onChange={(event) => {
                  setAddress({ state: event.target.value });
                }}
              />

              <Input
                label="CEP"
                block
                inputMode="numeric"
                placeholder="62010-000"
                value={draft.pickupAddress.zipCode}
                error={errors.address?.zipCode}
                onChange={(event) => {
                  setAddress({ zipCode: event.target.value });
                }}
              />
            </div>

            <Input
              label="Ponto de referencia"
              block
              maxLength={SETTINGS_LIMITS.reference}
              placeholder="Em frente a praca"
              hint="Em cidade pequena vale mais que o CEP."
              value={draft.pickupAddress.reference}
              error={errors.address?.reference}
              onChange={(event) => {
                setAddress({ reference: event.target.value });
              }}
            />

            <Textarea
              label="Instrucoes para quem vai retirar"
              block
              rows={3}
              maxLength={SETTINGS_LIMITS.pickupInstructions}
              placeholder="Toque a campainha. Estacionamento na lateral."
              value={draft.pickupInstructions}
              error={errors.pickupInstructions}
              onChange={(event) => {
                set({ pickupInstructions: event.target.value });
              }}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="secao-redes">
          <h2 className={styles.cardTitle} id="secao-redes">
            Redes sociais
          </h2>

          <p className={styles.cardHint}>
            Viram os icones do rodape. Cole o endereco inteiro ou so o arroba — o site monta o link
            a partir do que estiver aqui. Em branco, o icone nao aparece.
          </p>

          <div className={styles.pair}>
            <Input
              label="Instagram"
              block
              maxLength={SETTINGS_LIMITS.socialLink}
              placeholder="@maisonessence"
              value={draft.instagram}
              error={errors.instagram}
              onChange={(event) => {
                set({ instagram: event.target.value });
              }}
            />

            <Input
              label="TikTok"
              block
              maxLength={SETTINGS_LIMITS.socialLink}
              placeholder="@maisonessence"
              value={draft.tiktok}
              error={errors.tiktok}
              onChange={(event) => {
                set({ tiktok: event.target.value });
              }}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="secao-banners">
          <h2 className={styles.cardTitle} id="secao-banners">
            Carrossel da home
          </h2>

          <p className={styles.cardHint}>
            A primeira coisa que a cliente ve. Arraste para mudar a ordem; o agendamento coloca e
            tira a arte sozinho, sem ninguem precisar lembrar.
          </p>

          <Warnings warnings={warnings} scope="banners" />

          <BannerEditor
            banners={draft.banners}
            errors={errors.banners}
            onChange={(banners) => {
              set({ banners });
            }}
          />
        </section>

        <section className={styles.card} aria-labelledby="secao-paginas">
          <h2 className={styles.cardTitle} id="secao-paginas">
            Paginas do rodape
          </h2>

          <p className={styles.cardHint}>
            As cinco existem sempre, e o endereco de cada uma nao muda — esses links circulam no
            WhatsApp. O que se edita e o titulo, o texto e se a pagina esta publicada.
          </p>

          <Warnings warnings={warnings} scope="pages" />

          <PagesEditor
            pages={draft.pages}
            errors={errors.pages}
            onChange={(pages) => {
              set({ pages });
            }}
          />
        </section>
      </div>

      {dirty ? (
        <div className={styles.bar}>
          <p className={styles.barText} aria-live="polite">
            <strong className={styles.barTitle}>Alteracoes ainda nao salvas.</strong> O site
            continua como estava ate voce salvar.
          </p>

          <div className={styles.barActions}>
            <Button
              type="button"
              variant="secondary"
              disabled={save.isPending}
              onClick={() => {
                setDraft(draftFromStoreSettings(settings));
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
 * O que o servidor aceita e que some do site sem dizer nada.
 *
 * Aviso, e nao erro: nao bloqueia, nao usa vermelho e nao pede confirmacao. A
 * loja pode mesmo querer ficar um dia sem a barra de avisos — o que ela nao
 * pode e ficar sem saber que ficou.
 */
function Warnings({
  warnings,
  scope,
}: {
  warnings: readonly SettingsWarning[];
  scope: SettingsWarning['scope'];
}) {
  return (
    <>
      {warnings
        .filter((warning) => warning.scope === scope)
        .map((warning) => (
          <p key={warning.text} className={styles.warning}>
            <AlertIcon />
            {warning.text}
          </p>
        ))}
    </>
  );
}
