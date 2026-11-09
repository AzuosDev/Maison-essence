import { expect, test } from 'vitest';
import type { InstitutionalPageSlug } from '@/features/settings';
import { dayEndISO, dayStartISO } from '@/lib/format';
import type { AdminBanner, AdminShortcut, AdminStoreSettings } from './admin.types';
import {
  bannerStatus,
  changesOf,
  draftFromSettings,
  hasSettingsErrors,
  isDirty,
  linkFromTarget,
  moveBanner,
  moveItem,
  moveShortcut,
  newBanner,
  newShortcut,
  normalizeWhatsapp,
  prettyWhatsapp,
  targetFromLink,
  validateSettings,
  validateShortcuts,
  warningsOf,
  type PageDraft,
  type SettingsDraft,
} from './store-settings';

/**
 * As configurações da loja.
 *
 * Duas coisas erram em silêncio aqui, e as duas são caras:
 *
 * - **o número do WhatsApp mal normalizado** não da erro no painel. Da erro
 *   na mão do cliente, na hora de enviar o pedido, e ninguém fica sabendo;
 * - **a data do banner indo e voltando entre instante e dia** faria a tela
 *   se achar suja a cada abertura, e a dona aprenderia a ignorar a barra de
 *   salvar — que e o único aviso de que há algo por gravar.
 */

const BANNER: AdminBanner = {
  id: 'b1',
  imageDesktop: 'banners/verao-desktop',
  imageMobile: 'banners/verao-mobile',
  title: 'Coleção de verão',
  subtitle: 'Notas cítricas',
  buttonLabel: 'Ver a coleção',
  link: '/produtos',
  placement: 'hero',
  order: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

const SHORTCUT: AdminShortcut = {
  id: 's1',
  label: 'Hidratantes',
  image: 'shortcuts/hidratantes',
  link: '/categorias/hidratantes',
  order: 0,
  isActive: true,
};

function settings(patch: Partial<AdminStoreSettings> = {}): AdminStoreSettings {
  return {
    storeName: 'Maison Essence',
    whatsappNumber: '5588999999999',
    announcementText: 'Frete grátis acima de R$ 200',
    contactEmail: 'contato@maisonessence.test',
    businessHours: 'Seg a Sex, 9h as 18h',
    pickupEnabled: true,
    pickupAddress: {
      street: 'Rua das Flores',
      number: '120',
      complement: '',
      district: 'Centro',
      city: 'Sobral',
      state: 'CE',
      zipCode: '62010-000',
      reference: 'Em frente a praça',
    },
    pickupInstructions: 'Toque a campainha.',
    socialLinks: { instagram: '@maisonessence', tiktok: '' },
    freeShippingMinCents: 20_000,
    featuredPerfumeProductId: null,
    // A fileira de mais vendidos nasce no automatico, como a loja de verdade:
    // sem escolha nenhuma, o ranking das vendas manda.
    bestSellerProductIds: [],
    // A loja nasce sem campanha de brinde: o caso de base e o que mais
    // acontece.
    gift: { isActive: false, minCents: null, productId: null, label: '' },
    banners: [BANNER],
    shortcuts: [SHORTCUT],
    institutionalPages: [
      { slug: 'quem-somos', title: 'Quem somos', content: 'Texto', isActive: true },
      { slug: 'como-comprar', title: 'Como comprar', content: '', isActive: false },
    ],
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...patch,
  };
}

function draft(patch: Partial<SettingsDraft> = {}): SettingsDraft {
  return { ...draftFromSettings(settings()), ...patch };
}

/** As páginas do rascunho com uma delas alterada. */
function withPage(
  pages: readonly PageDraft[],
  slug: InstitutionalPageSlug,
  patch: Partial<PageDraft>,
): PageDraft[] {
  const next = [...pages];
  const at = next.findIndex((page) => page.slug === slug);
  const found = next[at];

  if (found !== undefined) {
    next[at] = { ...found, ...patch };
  }

  return next;
}

/* ---- Abrir a tela --------------------------------------------------------------- */

test('o número gravado volta legível, e a pontuação desfaz sem sobra', () => {
  expect(draftFromSettings(settings()).whatsapp).toBe('(88) 99999-9999');
  expect(normalizeWhatsapp('(88) 99999-9999')).toBe('5588999999999');
  expect(prettyWhatsapp('5588999999999')).toBe('(88) 99999-9999');
});

test('o número sem código do pais ganha o 55; o estrangeiro passa intacto', () => {
  expect(normalizeWhatsapp('88999999999')).toBe('5588999999999');
  expect(normalizeWhatsapp('351912345678')).toBe('351912345678');
  expect(normalizeWhatsapp('123')).toBeNull();
  expect(normalizeWhatsapp('')).toBe('');
});

test('sem mínimo geral de frete, o campo fica vazio', () => {
  // `0,00` seria frete grátis em qualquer pedido, que e outra coisa.
  expect(draftFromSettings(settings({ freeShippingMinCents: null })).freeShippingMin).toBe('');
  expect(draftFromSettings(settings()).freeShippingMin).toBe('200,00');
});

test('abrir a tela e não mexer em nada não gera chamada', () => {
  expect(changesOf(draft(), settings())).toBeNull();
  expect(isDirty(draft(), settings())).toBe(false);
});

test('o banner agendado vai e volta entre instante e dia sem se mexer', () => {
  // E a regressão que a nota no topo do módulo descreve: sem isto, a barra de
  // salvar apareceria sozinha a cada abertura da tela.
  const agendado = settings({
    banners: [{ ...BANNER, startsAt: dayStartISO('2026-11-20'), endsAt: dayEndISO('2026-11-30') }],
  });

  const aberto = draftFromSettings(agendado);

  expect(aberto.banners[0]?.startsOn).toBe('2026-11-20');
  expect(aberto.banners[0]?.endsOn).toBe('2026-11-30');
  expect(changesOf(aberto, agendado)).toBeNull();
});

/* ---- A validação ---------------------------------------------------------------- */

test('o que veio do servidor passa', () => {
  expect(hasSettingsErrors(validateSettings(draft(), settings()))).toBe(false);
});

test('o nome da loja e o número são conferidos', () => {
  expect(validateSettings(draft({ storeName: 'M' }), settings()).storeName).toBeDefined();
  expect(validateSettings(draft({ whatsapp: '99999' }), settings()).whatsapp).toBeDefined();
});

test('número em branco passa: e a loja que ainda não configurou', () => {
  expect(validateSettings(draft({ whatsapp: '' }), settings()).whatsapp).toBeUndefined();
});

test('o e-mail não pode ser apagado, porque o servidor recusaria o vazio', () => {
  const erros = validateSettings(draft({ contactEmail: '' }), settings());

  expect(erros.contactEmail).toBeDefined();

  // Numa loja que nunca teve e-mail, o campo vazio não e erro nenhum.
  expect(
    validateSettings(draft({ contactEmail: '' }), settings({ contactEmail: '' })).contactEmail,
  ).toBeUndefined();
});

test('o endereço da retirada não exige campo nenhum, mas confere o formato', () => {
  const vazio = draft({
    pickupAddress: {
      street: '',
      number: '',
      complement: '',
      district: '',
      city: '',
      state: '',
      zipCode: '',
      reference: '',
    },
  });

  // Faltar endereço vira aviso, e não erro: a dona escreve a rua hoje e o CEP
  // quando encontrar.
  expect(validateSettings(vazio, settings()).address).toBeUndefined();

  const torto = draft({
    pickupAddress: { ...draft().pickupAddress, zipCode: '620', state: 'Ceará' },
  });
  const erros = validateSettings(torto, settings()).address;

  expect(erros?.zipCode).toBeDefined();
  expect(erros?.state).toBeDefined();
});

test('um banner que termina antes de começar não passa', () => {
  const invertido = draft({
    banners: [{ ...draft().banners[0]!, startsOn: '2026-12-25', endsOn: '2026-12-01' }],
  });

  expect(validateSettings(invertido, settings()).banners?.b1?.window).toBeDefined();
});

test('um banner sem arte não passa', () => {
  const semArte = draft({ banners: [{ ...draft().banners[0]!, imageDesktop: '' }] });

  expect(validateSettings(semArte, settings()).banners?.b1?.imageDesktop).toBeDefined();
});

/* ---- Os avisos ------------------------------------------------------------------- */

test('loja sem WhatsApp avisa: o pedido não tem para onde ir', () => {
  expect(warningsOf(draft({ whatsapp: '' })).some((aviso) => aviso.scope === 'store')).toBe(true);
});

test('retirada ligada e sem endereço avisa', () => {
  const semEndereco = draft({
    pickupAddress: { ...draft().pickupAddress, street: '' },
  });

  expect(warningsOf(semEndereco).some((aviso) => aviso.scope === 'pickup')).toBe(true);
});

test('página publicada sem texto avisa, e diz qual e', () => {
  const vazia = draft({ pages: withPage(draft().pages, 'como-comprar', { isActive: true }) });

  const aviso = warningsOf(vazia).find((warning) => warning.scope === 'pages');

  expect(aviso?.text).toContain('Como comprar');
});

test('banner sem arte de celular avisa, mas não impede', () => {
  const semMobile = draft({ banners: [{ ...draft().banners[0]!, imageMobile: '' }] });

  expect(warningsOf(semMobile).some((aviso) => aviso.scope === 'banners')).toBe(true);
  expect(hasSettingsErrors(validateSettings(semMobile, settings()))).toBe(false);
});

test('a configuração que veio do servidor não gera aviso nenhum', () => {
  expect(warningsOf(draft())).toEqual([]);
});

/* ---- O diff ---------------------------------------------------------------------- */

test('só o campo alterado viaja', () => {
  expect(changesOf(draft({ storeName: 'Maison Essence Perfumes' }), settings())).toEqual({
    storeName: 'Maison Essence Perfumes',
  });
});

test('escrever o número com pontuação não conta como mudanca', () => {
  expect(changesOf(draft({ whatsapp: '88 99999-9999' }), settings())).toBeNull();
});

test('o endereço viaja campo a campo, e não inteiro', () => {
  // Corrigir o número da casa não pode apagar o ponto de referência — o
  // servidor funde o que chega com o que esta gravado.
  const mudado = draft({ pickupAddress: { ...draft().pickupAddress, number: '130' } });

  expect(changesOf(mudado, settings())).toEqual({ pickupAddress: { number: '130' } });
});

test('a sigla do estado em minúscula não conta como mudanca', () => {
  const minuscula = draft({ pickupAddress: { ...draft().pickupAddress, state: 'ce' } });

  expect(changesOf(minuscula, settings())).toBeNull();
});

test('apagar o mínimo geral manda null, e não zero', () => {
  expect(changesOf(draft({ freeShippingMin: '' }), settings())).toEqual({
    freeShippingMinCents: null,
  });
});

test('o carrossel vai inteiro, com a ordem que foi arrastada', () => {
  const dois = settings({ banners: [BANNER, { ...BANNER, id: 'b2', order: 1 }] });
  const aberto = draftFromSettings(dois);
  const trocado = { ...aberto, banners: moveBanner(aberto.banners, 0, 1) };

  const mudanca = changesOf(trocado, dois);

  expect(mudanca?.banners?.map((banner) => banner.id)).toEqual(['b2', 'b1']);
  expect(mudanca?.banners?.map((banner) => banner.order)).toEqual([0, 1]);
});

test('o banner novo vai sem id, que e o que faz o servidor cria-lo', () => {
  const aberto = draft();
  const comNovo = { ...aberto, banners: [...aberto.banners, newBanner('banners/natal')] };

  const mudanca = changesOf(comNovo, settings());

  expect(mudanca?.banners).toHaveLength(2);
  expect(mudanca?.banners?.[1]).not.toHaveProperty('id');
});

test('a data do banner sai como instante: o último dia inteiro entra', () => {
  const aberto = draft();
  const agendado = {
    ...aberto,
    banners: [{ ...aberto.banners[0]!, startsOn: '2026-12-01', endsOn: '2026-12-25' }],
  };

  const banner = changesOf(agendado, settings())?.banners?.[0];

  expect(banner?.startsAt).toBe(dayStartISO('2026-12-01'));
  expect(banner?.endsAt).toBe(dayEndISO('2026-12-25'));
});

test('só a página mexida viaja', () => {
  const aberto = draft();
  const mexida = {
    ...aberto,
    pages: withPage(aberto.pages, 'como-comprar', { content: 'Escolha, feche e pague.' }),
  };

  const mudanca = changesOf(mexida, settings());

  expect(mudanca?.institutionalPages).toHaveLength(1);
  expect(mudanca?.institutionalPages?.[0]?.slug).toBe('como-comprar');
});

test('um número inválido conta como pendência, ainda que não haja o que mandar', () => {
  const torto = draft({ whatsapp: '9999' });

  expect(changesOf(torto, settings())).toBeNull();
  expect(isDirty(torto, settings())).toBe(true);
});

/* ---- O estado do banner ------------------------------------------------------------ */

test('o banner sabe dizer se esta no ar, agendado ou encerrado', () => {
  const agora = new Date('2026-12-10T12:00:00');
  const base = draft().banners[0]!;

  expect(bannerStatus(base, agora)).toBe('live');
  expect(bannerStatus({ ...base, isActive: false }, agora)).toBe('off');
  expect(bannerStatus({ ...base, startsOn: '2026-12-20' }, agora)).toBe('scheduled');
  expect(bannerStatus({ ...base, endsOn: '2026-12-01' }, agora)).toBe('expired');
});

test('o último dia conta inteiro: o banner que termina hoje ainda esta no ar', () => {
  // "até 25/12" não pode sair do ar as 00h01 do dia 25.
  const agora = new Date('2026-12-25T12:00:00');

  expect(bannerStatus({ ...draft().banners[0]!, endsOn: '2026-12-25' }, agora)).toBe('live');
});

test('mover um banner para fora da lista devolve a lista como estava', () => {
  const banners = draft().banners;

  expect(moveBanner(banners, 0, 5)).toEqual(banners);
});

/* ---- O brinde ----------------------------------------------------------------------- */

/** O rascunho do brinde, ligado e completo. */
function comBrinde(patch: Partial<SettingsDraft['gift']> = {}): SettingsDraft {
  return draft({
    gift: {
      isActive: true,
      minValue: '179,99',
      productId: 'p1',
      label: 'um porta hidratante com a melhor pasta árabe dentro',
      ...patch,
    },
  });
}

test('o valor meta vai em centavos, e o resto do brinde vai junto', () => {
  const mudanca = changesOf(comBrinde(), settings());

  expect(mudanca?.gift).toEqual({
    isActive: true,
    minCents: 17_999,
    productId: 'p1',
    label: 'um porta hidratante com a melhor pasta árabe dentro',
  });
});

/**
 * Só o campo mexido viaja: o servidor funde o bloco campo a campo.
 *
 * E o que garante que trocar o valor meta não apague a frase do balão.
 */
test('mexer só no valor manda só o valor', () => {
  const gravado = settings({
    gift: {
      isActive: true,
      minCents: 17_999,
      productId: 'p1',
      label: 'um porta hidratante',
    },
  });
  const mexido = {
    ...draftFromSettings(gravado),
    gift: { ...draftFromSettings(gravado).gift, minValue: '199,90' },
  };

  expect(changesOf(mexido, gravado)?.gift).toEqual({ minCents: 19_990 });
});

/**
 * `179,9` e `179,90` são a mesma quantia.
 *
 * Comparadas como texto, a barra de salvar apareceria por causa de um zero
 * que a dona não digitou — e ela aprenderia a ignorar o único aviso de que
 * há algo por gravar.
 */
test('um zero a menos no centavo não e alteração', () => {
  const gravado = settings({
    gift: { isActive: true, minCents: 17_990, productId: null, label: 'um brinde' },
  });
  const mexido = {
    ...draftFromSettings(gravado),
    gift: { ...draftFromSettings(gravado).gift, minValue: '179,9' },
  };

  expect(changesOf(mexido, gravado)).toBeNull();
});

/** Tirar o produto precisa viajar como `null`, ou a escolha antiga fica. */
test('tirar o produto do brinde manda null', () => {
  const gravado = settings({
    gift: { isActive: true, minCents: 17_999, productId: 'p1', label: 'um brinde' },
  });
  const semProduto = {
    ...draftFromSettings(gravado),
    gift: { ...draftFromSettings(gravado).gift, productId: null },
  };

  expect(changesOf(semProduto, gravado)?.gift).toEqual({ productId: null });
});

test('a partir de zero todo pedido ganharia: isso e erro, não campanha', () => {
  const erros = validateSettings(comBrinde({ minValue: '0,00' }), settings());

  expect(erros.gift?.minValue).toBeDefined();
  expect(hasSettingsErrors(erros)).toBe(true);
});

/**
 * Brinde ligado pela metade e aviso, e não erro.
 *
 * A dona monta a campanha em duas sessões — escolhe o produto hoje, decide o
 * valor quando a nota do fornecedor chegar. Uma tela que recusasse o meio do
 * caminho a obrigaria a terminar de uma vez, ou a desligar o brinde para
 * conseguir salvar o CEP.
 */
test('brinde ligado e sem valor avisa, mas deixa salvar', () => {
  const pelaMetade = comBrinde({ minValue: '' });

  expect(hasSettingsErrors(validateSettings(pelaMetade, settings()))).toBe(false);
  expect(warningsOf(pelaMetade).map((aviso) => aviso.scope)).toContain('gift');
});

test('brinde ligado sem produto avisa que o balão sai sem foto', () => {
  const avisos = warningsOf(comBrinde({ productId: null }));

  expect(avisos.some((aviso) => aviso.scope === 'gift' && aviso.text.includes('foto'))).toBe(
    true,
  );
});

/** Desligado e estado legitimo: a tela não cobra campanha de ninguém. */
test('brinde desligado não avisa nada', () => {
  const desligado = comBrinde({ isActive: false, minValue: '', productId: null, label: '' });

  expect(warningsOf(desligado).filter((aviso) => aviso.scope === 'gift')).toEqual([]);
});

/* ---- Os atalhos da home ---------------------------------------------------- */

/**
 * O caminho tem que voltar igual ao que foi lido.
 *
 * E o mesmo risco da data do banner, por outro caminho: a tela guarda a
 * escolha ("a categoria hidratantes") e o servidor guarda o caminho
 * (`/categorias/hidratantes`). Se a volta não devolver exatamente o que
 * estava la, abrir a tela deixaria a barra de salvar aparecendo sozinha — e a
 * dona aprenderia a ignorar o único aviso de que há algo por gravar.
 */
test.each([
  ['/categorias/hidratantes', 'category', 'hidratantes'],
  ['/produtos?marca=Isabelle%20La%20Belle', 'brand', 'Isabelle La Belle'],
  ['/mais-vendidos', 'route', '/mais-vendidos'],
  ['/produtos?desconto=1', 'route', '/produtos?desconto=1'],
])('o destino %s volta como %s e monta o mesmo caminho', (link, kind, value) => {
  const target = targetFromLink(link);

  expect(target).toEqual({ kind, value });
  expect(linkFromTarget(target.kind, target.value)).toBe(link);
});

/**
 * A leitura e estrita de propósito.
 *
 * `/produtos?marca=Lattafa&pagina=2` lido como marca viraria
 * `/produtos?marca=Lattafa` no salvamento seguinte: a tela apagaria em
 * silêncio um pedaço do destino que alguém montou de propósito.
 */
test.each([
  '/produtos?marca=Lattafa&pagina=2',
  '/categorias/hidratantes/pastas',
  'https://instagram.com/maisonessence',
])('o endereço %s fica como esta escrito', (link) => {
  const target = targetFromLink(link);

  expect(target).toEqual({ kind: 'custom', value: link });
  expect(linkFromTarget(target.kind, target.value)).toBe(link);
});

test('abrir a tela com a fileira montada não a deixa suja', () => {
  const aberto = draft();

  expect(changesOf(aberto, settings())).toBeNull();
  expect(isDirty(aberto, settings())).toBe(false);
});

test('a fileira viaja inteira quando um atalho muda de lugar', () => {
  const dois = settings({
    shortcuts: [SHORTCUT, { ...SHORTCUT, id: 's2', label: 'Perfumes', order: 1 }],
  });
  const aberto = draftFromSettings(dois);

  const changes = changesOf(
    { ...aberto, shortcuts: moveShortcut(aberto.shortcuts, 0, 1) },
    dois,
  );

  expect(changes?.shortcuts?.map((shortcut) => shortcut.id)).toEqual(['s2', 's1']);
  // `order` sai da posição na lista, e não do que veio do servidor.
  expect(changes?.shortcuts?.map((shortcut) => shortcut.order)).toEqual([0, 1]);
});

test('atalho novo viaja sem id, que e o que faz o servidor criar', () => {
  const aberto = draft();
  const novo = { ...newShortcut(), label: 'Mais vendidos', targetKind: 'route' as const, targetValue: '/mais-vendidos' };

  const changes = changesOf({ ...aberto, shortcuts: [...aberto.shortcuts, novo] }, settings());

  expect(changes?.shortcuts?.[1]).toEqual({
    label: 'Mais vendidos',
    image: '',
    link: '/mais-vendidos',
    order: 1,
    isActive: true,
  });
  expect(changes?.shortcuts?.[1]).not.toHaveProperty('id');
});

test('atalho sem nome e sem destino e recusado, e a foto não e cobrada', () => {
  const errors = validateShortcuts([newShortcut()]);
  const key = Object.keys(errors)[0]!;

  expect(errors[key]?.label).toBeDefined();
  expect(errors[key]?.target).toBeDefined();

  const semFoto = validateShortcuts([
    { ...newShortcut(), label: 'Hidratantes', targetValue: 'hidratantes' },
  ]);

  expect(semFoto).toEqual({});
});

test('a fileira vazia avisa que a home volta as categorias', () => {
  const avisos = warningsOf(draft({ shortcuts: [] }))
    .filter((warning) => warning.scope === 'shortcuts')
    .map((warning) => warning.text);

  expect(avisos).toHaveLength(1);
  expect(avisos[0]).toContain('categorias principais');
});

test('atalho ligado sem foto avisa que o círculo mostra a inicial', () => {
  const avisos = warningsOf(
    draft({ shortcuts: [{ ...draft().shortcuts[0]!, image: '' }] }),
  ).filter((warning) => warning.scope === 'shortcuts');

  expect(avisos).toHaveLength(1);
  expect(avisos[0]?.text).toContain('inicial do nome');
});

/* ---- A fileira de mais vendidos ---------------------------------------------- */

/**
 * A fileira que a dona monta a dedo.
 *
 * O que estes testes cobram e o que a tela promete: a ordem e conteúdo, e a
 * lista vazia viaja. Sem o segundo, apagar a última escolha não mandaria nada
 * ao servidor e a fileira ficaria para sempre com um produto que a dona
 * acabou de tirar.
 */
test('a fileira de mais vendidos nasce sem escolha nenhuma', () => {
  expect(draft().bestSellerProductIds).toEqual([]);
  expect(changesOf(draft(), settings())).toBeNull();
});

test('escolher o primeiro produto manda a lista inteira', () => {
  const changes = changesOf(draft({ bestSellerProductIds: ['p1'] }), settings());

  expect(changes?.bestSellerProductIds).toEqual(['p1']);
});

test('trocar a ordem e uma alteração: a posição e o conteúdo', () => {
  const montada = settings({ bestSellerProductIds: ['p1', 'p2', 'p3'] });
  const aberto = draftFromSettings(montada);

  expect(changesOf(aberto, montada)).toBeNull();

  const changes = changesOf(
    { ...aberto, bestSellerProductIds: moveItem(aberto.bestSellerProductIds, 2, 0) },
    montada,
  );

  expect(changes?.bestSellerProductIds).toEqual(['p3', 'p1', 'p2']);
});

test('apagar a escolha manda a lista vazia, que devolve a fileira ao ranking', () => {
  const montada = settings({ bestSellerProductIds: ['p1'] });

  const changes = changesOf(
    { ...draftFromSettings(montada), bestSellerProductIds: [] },
    montada,
  );

  expect(changes?.bestSellerProductIds).toEqual([]);
});

/** Subir a primeira linha e descer a última não são erro: não fazem nada. */
test('mover para fora da lista devolve a lista como estava', () => {
  const ids = ['p1', 'p2'];

  expect(moveItem(ids, 0, -1)).toEqual(ids);
  expect(moveItem(ids, 1, 2)).toEqual(ids);
  expect(moveItem(ids, 0, 0)).toEqual(ids);
});
