import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  AlertIcon,
  ArrowLeftIcon,
  BannerEditor,
  BestSellersPicker,
  GiftEditor,
  PagesEditor,
  PerfumePicker,
  ShortcutEditor,
} from '@/components/admin';
import { Button, EmptyState, Input, Skeleton, Switch, Textarea, useToast } from '@/components/ui';
import {
  SETTINGS_LIMITS,
  canEditStoreFrame,
  canSee,
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
 * As configurações da loja.
 *
 * ## Vários assuntos, uma tela, um botão
 *
 * Nome da loja, retirada, brinde, atalhos da home, redes, carrossel, as duas
 * fileiras que a home mostra e as páginas moram no mesmo documento e são
 * gravados pelo mesmo `PATCH`. Poderiam ser oito telas, e não são: quem abre esta área o faz raramente, quase sempre
 * para mexer em uma coisa só — e descobrir *qual das sete telas* tem a barra
 * de avisos custa mais do que rolar uma página.
 *
 * ## O que só se descobre depois
 *
 * Três configurações desta tela são aceitas pelo servidor e somem do site sem
 * dizer nada: loja sem WhatsApp (o pedido fechado no checkout não tem para
 * onde ir), retirada ligada sem endereço, e página publicada sem texto. As
 * três viram aviso escrito, no bloco onde foram causadas.
 *
 * ## Quem entra, e até onde
 *
 * O gerente da loja e o administrador; o atendimento, não. E dentro da tela a
 * permissão se divide outra vez, por campo: as quatro primeiras seções são a
 * operação da loja — nome, contato, horário, barra de avisos, frete grátis,
 * retirada, o brinde por valor de compra e a fileira de atalhos da home — e o
 * gerente grava as quatro. As cinco últimas são a moldura: redes sociais,
 * carrossel, a fileira de mais vendidos, perfume da vez e páginas do rodapé.
 * Elas decidem o que a loja mostra em toda página — ou, no caso das duas da
 * home, na primeira tela de quem chega — e não mudam no expediente, e por
 * isso ficam com quem mantem o sistema.
 *
 * Para o gerente, essas cinco seções não são desabilitadas: elas não são
 * desenhadas. Campo cinza que não aceita digitação e um convite a perguntar
 * "por que não posso?" no meio do expediente, e a resposta seria uma conversa
 * sobre permissão. O lugar some, e no fim da tela fica uma linha dizendo o
 * que vive lá e a quem pedir.
 *
 * O servidor decide igual, campo a campo (`settings-access.policy.ts`), então
 * o que escapasse daqui morreria lá com 403.
 */
export default function AdminSettingsPage() {
  const role = useAdminRole();
  const { data: settings, isPending, isError, error } = useAdminSettings();

  usePageMeta({ title: 'Configurações — Painel', description: 'Acesso restrito.' });

  // `canSee` e não um `role === SUPER_ADMIN` escrito aqui: a tabela de áreas
  // e a única fonte da regra, e e ela que o menu também consulta. Duas copias
  // divergem no dia em que uma delas mudar.
  if (!canSee(role, 'settings')) {
    return (
      <EmptyState
        as="h1"
        title="Esta área e de quem administra a loja"
        description="Aqui ficam o nome da loja, o número para onde vai todo pedido, o carrossel da home e as páginas do rodapé. O seu acesso cobre o atendimento: o início do painel e os pedidos."
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
        <h1 className={styles.title}>Configurações</h1>

        <p className={styles.subtitle}>
          O que a loja diz de si: o nome, o contato, o que a home mostra primeiro e as páginas que o
          rodapé lista.
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
        <SettingsForm settings={settings} canEditFrame={canEditStoreFrame(role)} />
      )}
    </div>
  );
}

/* ---- O formulário ------------------------------------------------------------- */

function SettingsForm({
  settings,
  canEditFrame,
}: {
  settings: AdminStoreSettings;
  /** Desligado para o gerente: as quatro seções de moldura não são desenhadas. */
  canEditFrame: boolean;
}) {
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
        // O servidor devolve tudo normalizado — o número só com digitos, a
        // sigla em maiúscula — e os banners novos já com os seus `id`. Sem
        // reabrir o rascunho com a resposta, o próximo salvamento mandaria os
        // banners de novo sem `id` e criaria copias deles.
        setDraft(draftFromStoreSettings(saved));
        setTouched(false);
        // A promessa aqui era "quem abrir o site agora vê", e ela não era
        // verdade: entre esta gravação e a loja há a janela de cache da borda
        // (ver `cache-control.ts` no backend). Dizer o número e o que evita a
        // conclusão de que o painel não gravou — que foi o que aconteceu com
        // a troca de vaga dos banners.
        toast({
          variant: 'success',
          title: 'Gravado',
          description: 'A loja mostra o que você acabou de salvar em até um minuto.',
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
                hint="Aparece no cabeçalho, no título da aba e na mensagem do pedido."
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
                hint="E para este número que todo pedido fechado no site e enviado."
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
                label="Horário de atendimento"
                block
                maxLength={SETTINGS_LIMITS.businessHours}
                placeholder="Seg a Sex, 9h as 18h"
                hint="Texto livre, como a cliente lê no rodapé."
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
              placeholder="Frete grátis acima de R$ 200"
              hint="A faixa no topo de toda página. Em branco, a faixa não aparece."
              value={draft.announcementText}
              error={errors.announcementText}
              onChange={(event) => {
                set({ announcementText: event.target.value });
              }}
            />

            <Input
              label="Frete grátis a partir de"
              block
              numeric
              inputMode="decimal"
              prefix="R$"
              placeholder="sem mínimo geral"
              hint="Vale em qualquer cidade. A cidade que tiver regra própria, em Entrega, ignora esta."
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
            Com a retirada ligada, o checkout oferece a opção sem taxa e mostra este endereço depois
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
                label="Número"
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
              label="Ponto de referência"
              block
              maxLength={SETTINGS_LIMITS.reference}
              placeholder="Em frente a praça"
              hint="Em cidade pequena vale mais que o CEP."
              value={draft.pickupAddress.reference}
              error={errors.address?.reference}
              onChange={(event) => {
                setAddress({ reference: event.target.value });
              }}
            />

            <Textarea
              label="Instruções para quem vai retirar"
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

        {/*
          O brinde fica com a operação, e não com a moldura.

          E a mesma natureza do "frete grátis acima de R$ 199" que esta logo
          no primeiro cartão: uma regra de "compre X e ganhe Y", ligada e
          desligada conforme a campanha do mês. Apontar um produto não faz
          disso moldura — o que define a moldura e aparecer em toda página e
          não mudar no dia a dia. O servidor concorda, campo a campo
          (`settings-access.policy.ts`).
        */}
        <section className={styles.card} aria-labelledby="secao-brinde">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle} id="secao-brinde">
              O brinde
            </h2>

            <Switch
              label="Oferecer brinde"
              checked={draft.gift.isActive}
              onChange={(event) => {
                set({ gift: { ...draft.gift, isActive: event.target.checked } });
              }}
            />
          </div>

          <p className={styles.cardHint}>
            "Compre R$ 179,99 e ganhe um porta hidratante." O aviso aparece num balão no canto da
            loja, a régua da sacola passa a contar quanto falta, e o brinde entra na mensagem do
            pedido que chega no seu WhatsApp.
          </p>

          <Warnings warnings={warnings} scope="gift" />

          <GiftEditor
            gift={draft.gift}
            errors={errors.gift}
            onChange={(gift) => {
              set({ gift });
            }}
          />
        </section>

        {/*
          A fileira de atalhos fica com a operação, e não com a moldura.

          Pela mesma regra que decidiu o brinde: moldura e o que aparece em
          toda página e não muda no dia a dia. A fileira aparece só na home e
          muda com a campanha do mês — "Mais vendidos" na primeira posição em
          novembro, a marca nova em março. E, antes desta tela existir, quem
          mexia nela era quem reordenava Categorias, que e o gerente. Tirar
          isso dele agora seria um acesso perdido, não um acesso protegido.
        */}
        <section className={styles.card} aria-labelledby="secao-atalhos">
          <h2 className={styles.cardTitle} id="secao-atalhos">
            Atalhos da home
          </h2>

          <p className={styles.cardHint}>
            Os círculos logo abaixo do banner — o primeiro caminho de quem chega sem saber o que
            quer. Cada um tem nome, foto e para onde leva; arraste para mudar a ordem. Sem nenhum
            atalho, a home mostra as categorias principais.
          </p>

          <Warnings warnings={warnings} scope="shortcuts" />

          <ShortcutEditor
            shortcuts={draft.shortcuts}
            errors={errors.shortcuts}
            onChange={(shortcuts) => {
              set({ shortcuts });
            }}
          />
        </section>

        {canEditFrame ? (
          <>
            <section className={styles.card} aria-labelledby="secao-redes">
              <h2 className={styles.cardTitle} id="secao-redes">
                Redes sociais
              </h2>

              <p className={styles.cardHint}>
                Viram os ícones do rodapé. Cole o endereço inteiro ou só o arroba — o site monta o
                link a partir do que estiver aqui. Em branco, o ícone não aparece.
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
                Banners da home
              </h2>

              <p className={styles.cardHint}>
                O carrossel que abre a página e a faixa do meio dela. Cada banner escolhe a vaga
                em "Onde aparece"; arraste para mudar a ordem dentro da vaga. O agendamento coloca
                e tira a arte sozinho, sem ninguém precisar lembrar.
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

            {/*
          As três seções da home, na ordem em que a cliente as encontra: o
          carrossel abre a página, os mais vendidos são a primeira fileira
          dela, e o perfume da vez a fecha.

          E por isso que elas estão juntas e nesta ordem, e não junto dos
          textos da loja: lidas em sequencia, são o que a dona de fato vem
          conferir aqui — "o que a cliente vê primeiro, o que ela vê depois e
          com o que ela sai".
        */}
            <section className={styles.card} aria-labelledby="secao-mais-vendidos">
              <h2 className={styles.cardTitle} id="secao-mais-vendidos">
                Mais vendidos
              </h2>

              <p className={styles.cardHint}>
                A primeira fileira da home, e a que mais vende. Escolha os produtos e a ordem
                deles: a fileira e exatamente esta lista, e nada entra atrás para completar. Sem
                nenhuma escolha, ela volta ao automático — o que mais saiu nos pedidos, completado
                pelo catálogo.
              </p>

              <BestSellersPicker
                productIds={draft.bestSellerProductIds}
                onChange={(bestSellerProductIds) => {
                  set({ bestSellerProductIds });
                }}
              />
            </section>

            <section className={styles.card} aria-labelledby="secao-perfume">
              <h2 className={styles.cardTitle} id="secao-perfume">
                O perfume da vez
              </h2>

              <p className={styles.cardHint}>
                O bloco grande que fecha a home, com foto, descrição e botão de comprar. Escolha o
                produto aqui; sem escolha, a home mostra o último que você marcou como destaque.
              </p>

              <PerfumePicker
                productId={draft.featuredPerfumeProductId}
                onChange={(featuredPerfumeProductId) => {
                  set({ featuredPerfumeProductId });
                }}
              />
            </section>

            <section className={styles.card} aria-labelledby="secao-paginas">
              <h2 className={styles.cardTitle} id="secao-paginas">
                Páginas do rodapé
              </h2>

              <p className={styles.cardHint}>
                As seis existem sempre, e o endereço de cada uma não muda — esses links circulam no
                WhatsApp. O que se edita e o título, o texto e se a página esta publicada.
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
          </>
        ) : (
          <p className={styles.handover}>
            O carrossel da home, a fileira de mais vendidos, o perfume da vez, as páginas do
            rodapé e as redes sociais ficam com quem mantem o sistema — aparecem em toda página da loja e não mudam no dia a dia. Para
            trocar alguma delas, fale com essa pessoa.
          </p>
        )}
      </div>

      {dirty ? (
        <div className={styles.bar}>
          <p className={styles.barText} aria-live="polite">
            <strong className={styles.barTitle}>Alterações ainda não salvas.</strong> O site
            continua como estava até você salvar.
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
 * Aviso, e não erro: não bloqueia, não usa vermelho e não pede confirmação. A
 * loja pode mesmo querer ficar um dia sem a barra de avisos — o que ela não
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
