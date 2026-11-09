import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  AlertIcon,
  ArrowLeftIcon,
  BannerEditor,
  BestSellersPicker,
  ChevronRightIcon,
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
  type SettingsErrors,
  type SettingsWarning,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-settings-page.module.css';

/**
 * As configurações da loja.
 *
 * ## Nove assuntos, uma tela, um botão
 *
 * Nome da loja, retirada, brinde, atalhos da home, redes, carrossel, as duas
 * fileiras que a home mostra e as páginas moram no mesmo documento e são
 * gravados pelo mesmo `PATCH`. Poderiam ser nove telas, e não são: quem abre
 * esta área o faz raramente, quase sempre para mexer em uma coisa só — e
 * descobrir *qual das nove telas* tem a barra de avisos custa mais do que
 * qualquer rolagem.
 *
 * Então os nove assuntos abrem em grade: um retângulo para cada um, com o
 * título, uma linha dizendo o que vive lá dentro e como aquilo esta agora —
 * "retirada: desligada", "3 artes", "mais vendidos: no automático". A grade
 * responde de relance a pergunta que traz a dona aqui ("como esta a loja?") e
 * clicar abre **um** assunto, sozinho na tela, com um voltar.
 *
 * Um assunto por vez, e não os nove empilhados: nove cartões numa coluna fazem
 * quem veio trocar o banner rolar por endereço de retirada e regra de brinde
 * para chegar lá — e, no celular, essa rolagem e a tela inteira.
 *
 * O que a grade **não** faz e virar nove telas: o endereço do navegador não
 * muda, o rascunho e um só e a barra de gravar e uma só. Quem mexeu em dois
 * assuntos grava os dois de uma vez, num clique, e o voltar nunca perde o que
 * foi digitado.
 *
 * ## O que só se descobre depois
 *
 * Três configurações desta tela são aceitas pelo servidor e somem do site sem
 * dizer nada: loja sem WhatsApp (o pedido fechado no checkout não tem para
 * onde ir), retirada ligada sem endereço, e página publicada sem texto. As
 * três viram aviso escrito, no bloco onde foram causadas.
 *
 * E como o aviso — ou o erro — pode estar num assunto fechado, o retângulo
 * dele leva a marca: ponto vermelho quando há campo para corrigir ali dentro,
 * ponto dourado quando há aviso para ler. Gravar com erro abre o assunto
 * sozinho e diz qual e; sem isso, "Salvar" não faria nada e a tela não teria
 * dito por que. E o mesmo que `rate-table` faz com as modalidades de cartão.
 *
 * ## Quem entra, e até onde
 *
 * O gerente da loja e o administrador; o atendimento, não. E dentro da tela a
 * permissão se divide outra vez, por campo: quatro assuntos são a operação da
 * loja — nome, contato, horário, barra de avisos, frete grátis, retirada, o
 * brinde por valor de compra e a fileira de atalhos da home — e o gerente
 * grava os quatro. Os cinco outros são a moldura: redes sociais, carrossel, a
 * fileira de mais vendidos, perfume da vez e páginas do rodapé. Eles decidem o
 * que a loja mostra em toda página — ou, no caso dos dois da home, na primeira
 * tela de quem chega — e não mudam no expediente, e por isso ficam com quem
 * mantem o sistema.
 *
 * Para o gerente, esses cinco assuntos não são desabilitados: eles não entram
 * na grade. Retângulo cinza que não abre e um convite a perguntar "por que não
 * posso?" no meio do expediente, e a resposta seria uma conversa sobre
 * permissão. O lugar some, e abaixo da grade fica uma linha dizendo o que vive
 * lá e a quem pedir.
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

/* ---- Os assuntos -------------------------------------------------------------- */

/**
 * Os nove assuntos, na ordem em que a cliente encontra o que eles ajustam: o
 * que ela lê da loja, depois a home de cima para baixo, depois o rodapé.
 *
 * A chave não vai para o endereço do navegador — e estado da tela, não rota —,
 * então ela existe só para ligar retângulo, painel e marca.
 */
const SUBJECTS = [
  'loja',
  'retirada',
  'brinde',
  'banners',
  'atalhos',
  'mais-vendidos',
  'perfume',
  'redes',
  'paginas',
] as const;

type Subject = (typeof SUBJECTS)[number];

/** Os assuntos de moldura: fora da grade de quem não os grava. */
const FRAME_SUBJECTS: ReadonlySet<Subject> = new Set([
  'banners',
  'mais-vendidos',
  'perfume',
  'redes',
  'paginas',
]);

const SUBJECT_TITLES: Record<Subject, string> = {
  loja: 'A loja',
  retirada: 'Retirada na loja',
  brinde: 'O brinde',
  banners: 'Banners da home',
  atalhos: 'Atalhos da home',
  'mais-vendidos': 'Mais vendidos',
  perfume: 'O perfume da vez',
  redes: 'Redes sociais',
  paginas: 'Páginas do rodapé',
};

/** O que vive dentro, numa linha. O estado atual vem do rascunho, em `statusOf`. */
const SUBJECT_SUMMARIES: Record<Subject, string> = {
  loja: 'Nome, WhatsApp, e-mail, horário, barra de avisos e frete grátis.',
  retirada: 'Endereço, ponto de referência e instruções para quem busca.',
  brinde: 'A regra de "compre X e ganhe Y" e o produto do mês.',
  banners: 'O carrossel que abre a home e a faixa do meio dela.',
  atalhos: 'Os círculos logo abaixo do banner.',
  'mais-vendidos': 'A primeira fileira da home, e a que mais vende.',
  perfume: 'O bloco grande que fecha a home.',
  redes: 'Os ícones de Instagram e TikTok do rodapé.',
  paginas: 'Título, texto e publicação das seis páginas.',
};

/** Em que retângulo mora cada aviso. Os escopos vem de `settingsWarningsOf`. */
const WARNING_SUBJECTS: Record<SettingsWarning['scope'], Subject> = {
  store: 'loja',
  pickup: 'retirada',
  gift: 'brinde',
  banners: 'banners',
  shortcuts: 'atalhos',
  pages: 'paginas',
};

/** Os campos de texto de cada assunto, para achar o assunto do erro. */
const SUBJECT_FIELDS = {
  loja: [
    'storeName',
    'whatsapp',
    'contactEmail',
    'businessHours',
    'announcementText',
    'freeShippingMin',
  ],
  retirada: ['pickupInstructions'],
  redes: ['instagram', 'tiktok'],
} as const satisfies Partial<Record<Subject, readonly (keyof SettingsErrors)[]>>;

/** `true` quando alguma das listas de erro aninhadas tem item. */
function someOf(entries: readonly (object | undefined)[]): boolean {
  return entries.some((entry) => entry !== undefined && Object.keys(entry).length > 0);
}

/**
 * Os assuntos com erro dentro, na ordem da grade.
 *
 * Só o que esta desenhado: para o gerente, banners e páginas não entram na
 * grade, e marca apontando para campo que ele não ve seria um beco.
 */
function subjectsWithError(errors: SettingsErrors, drawn: readonly Subject[]): readonly Subject[] {
  const found: Record<Subject, boolean> = {
    loja: SUBJECT_FIELDS.loja.some((field) => errors[field] !== undefined),
    retirada:
      SUBJECT_FIELDS.retirada.some((field) => errors[field] !== undefined) ||
      someOf([errors.address]),
    brinde: someOf([errors.gift]),
    banners: someOf(Object.values(errors.banners ?? {})),
    atalhos: someOf(Object.values(errors.shortcuts ?? {})),
    'mais-vendidos': false,
    perfume: false,
    redes: SUBJECT_FIELDS.redes.some((field) => errors[field] !== undefined),
    paginas: someOf(Object.values(errors.pages ?? {})),
  };

  return drawn.filter((subject) => found[subject]);
}

/**
 * Como o assunto esta agora, em duas ou tres palavras.
 *
 * Sai do rascunho, e não do que esta gravado: a grade tem de concordar com o
 * que a pessoa acabou de digitar lá dentro, ou o voltar pareceria ter perdido
 * a alteração.
 */
function statusOf(draft: SettingsDraft, subject: Subject): string {
  switch (subject) {
    case 'loja':
      return draft.storeName.trim() === '' ? 'sem nome' : draft.storeName.trim();
    case 'retirada':
      return draft.pickupEnabled ? 'oferecendo' : 'desligada';
    case 'brinde':
      return draft.gift.isActive ? 'ativo' : 'desligado';
    case 'banners':
      return countOf(draft.banners.length, 'arte', 'artes');
    case 'atalhos':
      return draft.shortcuts.length === 0
        ? 'nas categorias'
        : countOf(draft.shortcuts.length, 'atalho', 'atalhos');
    case 'mais-vendidos':
      return draft.bestSellerProductIds.length === 0
        ? 'no automático'
        : countOf(draft.bestSellerProductIds.length, 'produto', 'produtos');
    case 'perfume':
      return draft.featuredPerfumeProductId === null ? 'no automático' : 'escolhido';
    case 'redes':
      return socialStatusOf(draft);
    case 'paginas':
      return `${draft.pages.filter((page) => page.isActive).length} de ${draft.pages.length} publicadas`;
  }
}

function countOf(total: number, one: string, many: string): string {
  return total === 1 ? `1 ${one}` : `${total} ${many}`;
}

function socialStatusOf(draft: SettingsDraft): string {
  const filled = [
    draft.instagram.trim() === '' ? null : 'Instagram',
    draft.tiktok.trim() === '' ? null : 'TikTok',
  ].filter((name): name is string => name !== null);

  return filled.length === 0 ? 'nenhuma' : filled.join(' e ');
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
  const [open, setOpen] = useState<Subject | null>(null);

  const panel = useRef<HTMLDivElement>(null);
  /** De qual retângulo a pessoa entrou, para o foco voltar para ele. */
  const cameFrom = useRef<Subject | null>(null);

  const errors = touched ? validateSettings(draft, settings) : {};
  const warnings = settingsWarningsOf(draft);
  const dirty = isSettingsDirty(draft, settings);

  // A moldura não entra na grade de quem não a grava.
  const drawn = canEditFrame
    ? SUBJECTS
    : SUBJECTS.filter((subject) => !FRAME_SUBJECTS.has(subject));

  const broken = subjectsWithError(errors, drawn);
  const flagged = new Set(warnings.map((warning) => WARNING_SUBJECTS[warning.scope]));

  // Nunca um assunto que esta tela não desenha.
  const showing = open !== null && drawn.includes(open) ? open : null;

  // Abrir um assunto troca a tela inteira: o foco acompanha, senão o próximo
  // Tab continuaria de onde o retângulo clicado estava — num botão que já não
  // existe. Fechar devolve o foco ao retângulo de onde a pessoa entrou.
  useEffect(() => {
    if (showing !== null) {
      panel.current?.focus();
      return;
    }

    const back = cameFrom.current;

    if (back !== null) {
      cameFrom.current = null;
      document.getElementById(tileId(back))?.focus();
    }
  }, [showing]);

  const set = (patch: Partial<SettingsDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const setAddress = (patch: Partial<AddressDraft>): void => {
    setDraft((current) => ({ ...current, pickupAddress: { ...current.pickupAddress, ...patch } }));
  };

  const openSubject = (subject: Subject): void => {
    cameFrom.current = subject;
    setOpen(subject);
    scrollUp();
  };

  const closeSubject = (): void => {
    setOpen(null);
    scrollUp();
  };

  const submit = (): void => {
    setTouched(true);

    const found = validateSettings(draft, settings);

    // Os erros antes do `changes === null`, e não depois: o e-mail de contato
    // vazio não viaja no patch, então e-mail invalido deixa `changes` nulo. Na
    // ordem antiga "Salvar" saia calado — e agora o campo ainda podia estar
    // num assunto fechado.
    if (hasSettingsErrors(found)) {
      const blocked = subjectsWithError(found, drawn)[0];

      if (blocked !== undefined) {
        openSubject(blocked);
      }

      toast({
        variant: 'danger',
        title: 'Nada foi gravado',
        description:
          blocked === undefined
            ? 'Há campo para corrigir nesta tela.'
            : `Há campo para corrigir em “${SUBJECT_TITLES[blocked]}”.`,
      });

      return;
    }

    const changes = settingsChangesOf(draft, settings);

    if (changes === null) {
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
      {showing === null ? (
        <>
          <ul className={styles.hub} aria-label="Assuntos das configurações">
            {drawn.map((subject) => (
              <li key={subject} className={styles.tileCell}>
                {/*
                  O nome do botão e só o título; o resumo e o estado atual vão
                  como descrição. Sem essa separação, cada retângulo se
                  anunciaria em três frases, e uma grade de nove viraria um
                  parágrafo lido em voz alta.
                */}
                <button
                  type="button"
                  id={tileId(subject)}
                  className={styles.tile}
                  aria-labelledby={`${tileId(subject)}-titulo`}
                  aria-describedby={`${tileId(subject)}-resumo ${tileId(subject)}-estado`}
                  onClick={() => {
                    openSubject(subject);
                  }}
                >
                  <span className={styles.tileTitle} id={`${tileId(subject)}-titulo`}>
                    {SUBJECT_TITLES[subject]}

                    {/*
                      O assunto fechado também e conferido, e o erro dele
                      recusa a gravação inteira — entao a marca precisa estar
                      aqui, senao "Salvar" não faria nada e a tela não teria
                      dito onde. Mesmo vocabulário de `rate-table`; o texto
                      oculto acompanha porque a cor não pode ser a unica a
                      dizer.
                    */}
                    {broken.includes(subject) ? (
                      <>
                        <span className={styles.flag} aria-hidden="true" />
                        <span className="visually-hidden">tem campo para corrigir</span>
                      </>
                    ) : flagged.has(subject) ? (
                      <>
                        <span className={styles.note} aria-hidden="true" />
                        <span className="visually-hidden">tem aviso para ler</span>
                      </>
                    ) : null}
                  </span>

                  <span className={styles.tileSummary} id={`${tileId(subject)}-resumo`}>
                    {SUBJECT_SUMMARIES[subject]}
                  </span>

                  <span className={styles.tileFoot}>
                    <span className={styles.tileStatus} id={`${tileId(subject)}-estado`}>
                      {statusOf(draft, subject)}
                    </span>
                    <ChevronRightIcon />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {canEditFrame ? null : (
            <p className={styles.handover}>
              O carrossel da home, a fileira de mais vendidos, o perfume da vez, as páginas do
              rodapé e as redes sociais ficam com quem mantem o sistema — aparecem em toda página da
              loja e não mudam no dia a dia. Para trocar alguma delas, fale com essa pessoa.
            </p>
          )}
        </>
      ) : (
        <div className={styles.panel} ref={panel} tabIndex={-1}>
          <button type="button" className={styles.back} onClick={closeSubject}>
            <ArrowLeftIcon />
            Todos os assuntos
          </button>

          {showing === 'loja' ? (
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
          ) : null}

          {showing === 'retirada' ? (
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
                Com a retirada ligada, o checkout oferece a opção sem taxa e mostra este endereço
                depois que o pedido e fechado.
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
          ) : null}

          {/*
          O brinde fica com a operação, e não com a moldura.

          E a mesma natureza do "frete grátis acima de R$ 199" que esta logo
          no primeiro cartão: uma regra de "compre X e ganhe Y", ligada e
          desligada conforme a campanha do mês. Apontar um produto não faz
          disso moldura — o que define a moldura e aparecer em toda página e
          não mudar no dia a dia. O servidor concorda, campo a campo
          (`settings-access.policy.ts`).
        */}
          {showing === 'brinde' ? (
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
                "Compre R$ 179,99 e ganhe um porta hidratante." O aviso aparece num balão no canto
                da loja, a régua da sacola passa a contar quanto falta, e o brinde entra na mensagem
                do pedido que chega no seu WhatsApp.
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
          ) : null}

          {showing === 'banners' ? (
            <section className={styles.card} aria-labelledby="secao-banners">
              <h2 className={styles.cardTitle} id="secao-banners">
                Banners da home
              </h2>

              <p className={styles.cardHint}>
                O carrossel que abre a página e a faixa do meio dela. Cada banner escolhe a vaga em
                "Onde aparece"; arraste para mudar a ordem dentro da vaga. O agendamento coloca e
                tira a arte sozinho, sem ninguém precisar lembrar.
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
          ) : null}

          {/*
          A fileira de atalhos fica com a operação, e não com a moldura.

          Pela mesma regra que decidiu o brinde: moldura e o que aparece em
          toda página e não muda no dia a dia. A fileira aparece só na home e
          muda com a campanha do mês — "Mais vendidos" na primeira posição em
          novembro, a marca nova em março. E, antes desta tela existir, quem
          mexia nela era quem reordenava Categorias, que e o gerente. Tirar
          isso dele agora seria um acesso perdido, não um acesso protegido.
        */}
          {showing === 'atalhos' ? (
            <section className={styles.card} aria-labelledby="secao-atalhos">
              <h2 className={styles.cardTitle} id="secao-atalhos">
                Atalhos da home
              </h2>

              <p className={styles.cardHint}>
                Os círculos logo abaixo do banner — o primeiro caminho de quem chega sem saber o que
                quer. Cada um tem nome, foto e para onde leva; arraste para mudar a ordem. Sem
                nenhum atalho, a home mostra as categorias principais.
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
          ) : null}

          {showing === 'mais-vendidos' ? (
            <section className={styles.card} aria-labelledby="secao-mais-vendidos">
              <h2 className={styles.cardTitle} id="secao-mais-vendidos">
                Mais vendidos
              </h2>

              <p className={styles.cardHint}>
                A primeira fileira da home, e a que mais vende. Escolha os produtos e a ordem deles:
                a fileira e exatamente esta lista, e nada entra atrás para completar. Sem nenhuma
                escolha, ela volta ao automático — o que mais saiu nos pedidos, completado pelo
                catálogo.
              </p>

              <BestSellersPicker
                productIds={draft.bestSellerProductIds}
                onChange={(bestSellerProductIds) => {
                  set({ bestSellerProductIds });
                }}
              />
            </section>
          ) : null}

          {showing === 'perfume' ? (
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
          ) : null}

          {showing === 'redes' ? (
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
          ) : null}

          {showing === 'paginas' ? (
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
          ) : null}
        </div>
      )}

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

/* ---- Miudezas ------------------------------------------------------------------ */

/** O id do retângulo, para o foco voltar para ele ao fechar o assunto. */
function tileId(subject: Subject): string {
  return `assunto-${subject}`;
}

/**
 * Volta ao alto ao trocar o que a tela mostra.
 *
 * Atras do `scrollY` de propósito: sem rolagem nenhuma, não há o que corrigir
 * — e mexer na página de quem nem rolou e movimento que ninguém pediu.
 */
function scrollUp(): void {
  if (window.scrollY > 0) {
    window.scrollTo({ top: 0 });
  }
}
