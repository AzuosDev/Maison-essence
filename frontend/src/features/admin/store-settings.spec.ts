import { expect, test } from 'vitest';
import type { InstitutionalPageSlug } from '@/features/settings';
import { dayEndISO, dayStartISO } from '@/lib/format';
import type { AdminBanner, AdminStoreSettings } from './admin.types';
import {
  bannerStatus,
  changesOf,
  draftFromSettings,
  hasSettingsErrors,
  isDirty,
  moveBanner,
  newBanner,
  normalizeWhatsapp,
  prettyWhatsapp,
  validateSettings,
  warningsOf,
  type PageDraft,
  type SettingsDraft,
} from './store-settings';

/**
 * As configuracoes da loja.
 *
 * Duas coisas erram em silencio aqui, e as duas sao caras:
 *
 * - **o numero do WhatsApp mal normalizado** nao da erro no painel. Da erro
 *   na mao do cliente, na hora de enviar o pedido, e ninguem fica sabendo;
 * - **a data do banner indo e voltando entre instante e dia** faria a tela
 *   se achar suja a cada abertura, e a dona aprenderia a ignorar a barra de
 *   salvar — que e o unico aviso de que ha algo por gravar.
 */

const BANNER: AdminBanner = {
  id: 'b1',
  imageDesktop: 'banners/verao-desktop',
  imageMobile: 'banners/verao-mobile',
  title: 'Colecao de verao',
  subtitle: 'Notas citricas',
  buttonLabel: 'Ver a colecao',
  link: '/produtos',
  order: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

function settings(patch: Partial<AdminStoreSettings> = {}): AdminStoreSettings {
  return {
    storeName: 'Maison Essence',
    whatsappNumber: '5588999999999',
    announcementText: 'Frete gratis acima de R$ 200',
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
      reference: 'Em frente a praca',
    },
    pickupInstructions: 'Toque a campainha.',
    socialLinks: { instagram: '@maisonessence', tiktok: '' },
    freeShippingMinCents: 20_000,
    banners: [BANNER],
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

/** As paginas do rascunho com uma delas alterada. */
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

test('o numero gravado volta legivel, e a pontuacao desfaz sem sobra', () => {
  expect(draftFromSettings(settings()).whatsapp).toBe('(88) 99999-9999');
  expect(normalizeWhatsapp('(88) 99999-9999')).toBe('5588999999999');
  expect(prettyWhatsapp('5588999999999')).toBe('(88) 99999-9999');
});

test('o numero sem codigo do pais ganha o 55; o estrangeiro passa intacto', () => {
  expect(normalizeWhatsapp('88999999999')).toBe('5588999999999');
  expect(normalizeWhatsapp('351912345678')).toBe('351912345678');
  expect(normalizeWhatsapp('123')).toBeNull();
  expect(normalizeWhatsapp('')).toBe('');
});

test('sem minimo geral de frete, o campo fica vazio', () => {
  // `0,00` seria frete gratis em qualquer pedido, que e outra coisa.
  expect(draftFromSettings(settings({ freeShippingMinCents: null })).freeShippingMin).toBe('');
  expect(draftFromSettings(settings()).freeShippingMin).toBe('200,00');
});

test('abrir a tela e nao mexer em nada nao gera chamada', () => {
  expect(changesOf(draft(), settings())).toBeNull();
  expect(isDirty(draft(), settings())).toBe(false);
});

test('o banner agendado vai e volta entre instante e dia sem se mexer', () => {
  // E a regressao que a nota no topo do modulo descreve: sem isto, a barra de
  // salvar apareceria sozinha a cada abertura da tela.
  const agendado = settings({
    banners: [{ ...BANNER, startsAt: dayStartISO('2026-11-20'), endsAt: dayEndISO('2026-11-30') }],
  });

  const aberto = draftFromSettings(agendado);

  expect(aberto.banners[0]?.startsOn).toBe('2026-11-20');
  expect(aberto.banners[0]?.endsOn).toBe('2026-11-30');
  expect(changesOf(aberto, agendado)).toBeNull();
});

/* ---- A validacao ---------------------------------------------------------------- */

test('o que veio do servidor passa', () => {
  expect(hasSettingsErrors(validateSettings(draft(), settings()))).toBe(false);
});

test('o nome da loja e o numero sao conferidos', () => {
  expect(validateSettings(draft({ storeName: 'M' }), settings()).storeName).toBeDefined();
  expect(validateSettings(draft({ whatsapp: '99999' }), settings()).whatsapp).toBeDefined();
});

test('numero em branco passa: e a loja que ainda nao configurou', () => {
  expect(validateSettings(draft({ whatsapp: '' }), settings()).whatsapp).toBeUndefined();
});

test('o e-mail nao pode ser apagado, porque o servidor recusaria o vazio', () => {
  const erros = validateSettings(draft({ contactEmail: '' }), settings());

  expect(erros.contactEmail).toBeDefined();

  // Numa loja que nunca teve e-mail, o campo vazio nao e erro nenhum.
  expect(
    validateSettings(draft({ contactEmail: '' }), settings({ contactEmail: '' })).contactEmail,
  ).toBeUndefined();
});

test('o endereco da retirada nao exige campo nenhum, mas confere o formato', () => {
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

  // Faltar endereco vira aviso, e nao erro: a dona escreve a rua hoje e o CEP
  // quando encontrar.
  expect(validateSettings(vazio, settings()).address).toBeUndefined();

  const torto = draft({
    pickupAddress: { ...draft().pickupAddress, zipCode: '620', state: 'Ceara' },
  });
  const erros = validateSettings(torto, settings()).address;

  expect(erros?.zipCode).toBeDefined();
  expect(erros?.state).toBeDefined();
});

test('um banner que termina antes de comecar nao passa', () => {
  const invertido = draft({
    banners: [{ ...draft().banners[0]!, startsOn: '2026-12-25', endsOn: '2026-12-01' }],
  });

  expect(validateSettings(invertido, settings()).banners?.b1?.window).toBeDefined();
});

test('um banner sem arte nao passa', () => {
  const semArte = draft({ banners: [{ ...draft().banners[0]!, imageDesktop: '' }] });

  expect(validateSettings(semArte, settings()).banners?.b1?.imageDesktop).toBeDefined();
});

/* ---- Os avisos ------------------------------------------------------------------- */

test('loja sem WhatsApp avisa: o pedido nao tem para onde ir', () => {
  expect(warningsOf(draft({ whatsapp: '' })).some((aviso) => aviso.scope === 'store')).toBe(true);
});

test('retirada ligada e sem endereco avisa', () => {
  const semEndereco = draft({
    pickupAddress: { ...draft().pickupAddress, street: '' },
  });

  expect(warningsOf(semEndereco).some((aviso) => aviso.scope === 'pickup')).toBe(true);
});

test('pagina publicada sem texto avisa, e diz qual e', () => {
  const vazia = draft({ pages: withPage(draft().pages, 'como-comprar', { isActive: true }) });

  const aviso = warningsOf(vazia).find((warning) => warning.scope === 'pages');

  expect(aviso?.text).toContain('Como comprar');
});

test('banner sem arte de celular avisa, mas nao impede', () => {
  const semMobile = draft({ banners: [{ ...draft().banners[0]!, imageMobile: '' }] });

  expect(warningsOf(semMobile).some((aviso) => aviso.scope === 'banners')).toBe(true);
  expect(hasSettingsErrors(validateSettings(semMobile, settings()))).toBe(false);
});

test('a configuracao que veio do servidor nao gera aviso nenhum', () => {
  expect(warningsOf(draft())).toEqual([]);
});

/* ---- O diff ---------------------------------------------------------------------- */

test('so o campo alterado viaja', () => {
  expect(changesOf(draft({ storeName: 'Maison Essence Perfumes' }), settings())).toEqual({
    storeName: 'Maison Essence Perfumes',
  });
});

test('escrever o numero com pontuacao nao conta como mudanca', () => {
  expect(changesOf(draft({ whatsapp: '88 99999-9999' }), settings())).toBeNull();
});

test('o endereco viaja campo a campo, e nao inteiro', () => {
  // Corrigir o numero da casa nao pode apagar o ponto de referencia — o
  // servidor funde o que chega com o que esta gravado.
  const mudado = draft({ pickupAddress: { ...draft().pickupAddress, number: '130' } });

  expect(changesOf(mudado, settings())).toEqual({ pickupAddress: { number: '130' } });
});

test('a sigla do estado em minuscula nao conta como mudanca', () => {
  const minuscula = draft({ pickupAddress: { ...draft().pickupAddress, state: 'ce' } });

  expect(changesOf(minuscula, settings())).toBeNull();
});

test('apagar o minimo geral manda null, e nao zero', () => {
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

test('a data do banner sai como instante: o ultimo dia inteiro entra', () => {
  const aberto = draft();
  const agendado = {
    ...aberto,
    banners: [{ ...aberto.banners[0]!, startsOn: '2026-12-01', endsOn: '2026-12-25' }],
  };

  const banner = changesOf(agendado, settings())?.banners?.[0];

  expect(banner?.startsAt).toBe(dayStartISO('2026-12-01'));
  expect(banner?.endsAt).toBe(dayEndISO('2026-12-25'));
});

test('so a pagina mexida viaja', () => {
  const aberto = draft();
  const mexida = {
    ...aberto,
    pages: withPage(aberto.pages, 'como-comprar', { content: 'Escolha, feche e pague.' }),
  };

  const mudanca = changesOf(mexida, settings());

  expect(mudanca?.institutionalPages).toHaveLength(1);
  expect(mudanca?.institutionalPages?.[0]?.slug).toBe('como-comprar');
});

test('um numero invalido conta como pendencia, ainda que nao haja o que mandar', () => {
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

test('o ultimo dia conta inteiro: o banner que termina hoje ainda esta no ar', () => {
  // "ate 25/12" nao pode sair do ar as 00h01 do dia 25.
  const agora = new Date('2026-12-25T12:00:00');

  expect(bannerStatus({ ...draft().banners[0]!, endsOn: '2026-12-25' }, agora)).toBe('live');
});

test('mover um banner para fora da lista devolve a lista como estava', () => {
  const banners = draft().banners;

  expect(moveBanner(banners, 0, 5)).toEqual(banners);
});
