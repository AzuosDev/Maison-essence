import { UnprocessableEntityException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { FULFILLMENT_MODES } from '../../common/enums/fulfillment-mode.js';
import type { DeliveryCity } from '../../schemas.js';
import type { SettingsService } from '../settings/settings.service.js';
import type { StoreSettingsDocument } from '../settings/schemas/store-settings.schema.js';
import { DeliveryService } from './delivery.service.js';
import {
  CITY_REQUIRED_MESSAGE,
  CITY_UNAVAILABLE_MESSAGE,
  PICKUP_DISABLED_MESSAGE,
} from './delivery.constants.js';
import type { DeliveryCityDocument } from './schemas/delivery-city.schema.js';

/**
 * `resolveFee` sem banco e sem HTTP.
 *
 * A conta em si ja e testada em `delivery-fee.spec.ts`, que e funcao pura. O
 * que se confere aqui e o que o servico acrescenta a ela e que nenhuma funcao
 * pura pode cobrir: a leitura das configuracoes da loja, a recusa da cidade
 * que nao e mais atendida e o congelamento de nome, estado e prazo que o
 * pedido vai guardar. Sao justamente as decisoes que, se saissem erradas,
 * apareceriam na conta do cliente.
 */
const CITY_ID = new Types.ObjectId();

function cityWith(overrides: Partial<DeliveryCity> = {}): DeliveryCityDocument {
  return {
    _id: CITY_ID,
    name: 'Juazeiro do Norte',
    state: 'CE',
    feeCents: 1_500,
    estimatedDays: 2,
    minOrderForFreeCents: null,
    isActive: true,
    ...overrides,
  } as DeliveryCityDocument;
}

function storeWith(overrides: Partial<StoreSettingsDocument> = {}): StoreSettingsDocument {
  return {
    pickupEnabled: true,
    freeShippingMinCents: null,
    ...overrides,
  } as StoreSettingsDocument;
}

/** O que o servico recebeu no `findOne`, para conferir o filtro. */
interface Lookup {
  filter?: Record<string, unknown>;
}

function serviceWith(
  store: StoreSettingsDocument,
  city: DeliveryCityDocument | null,
  lookup: Lookup = {},
): DeliveryService {
  const cities = {
    findOne: (filter: Record<string, unknown>) => {
      lookup.filter = filter;

      return { exec: () => Promise.resolve(city) };
    },
  } as unknown as Model<DeliveryCity>;
  const settings = { current: () => Promise.resolve(store) } as unknown as SettingsService;

  return new DeliveryService(cities, settings);
}

describe('DeliveryService.resolveFee', () => {
  describe('retirada', () => {
    it('zera a taxa e dispensa endereço', async () => {
      const service = serviceWith(storeWith(), null);

      const quote = await service.resolveFee({
        mode: FULFILLMENT_MODES.PICKUP,
        subtotalCents: 12_000,
      });

      expect(quote.feeCents).toBe(0);
      expect(quote.isFree).toBe(true);
      expect(quote.requiresAddress).toBe(false);
      expect(quote.cityId).toBeNull();
      expect(quote.freeReason).not.toBe('');
    });

    it('recusa quando a loja não recebe para retirada', async () => {
      const service = serviceWith(storeWith({ pickupEnabled: false }), null);

      // Taxa zero e facil; o que nao existe e o lugar de buscar.
      await expect(
        service.resolveFee({ mode: FULFILLMENT_MODES.PICKUP, subtotalCents: 12_000 }),
      ).rejects.toThrow(new UnprocessableEntityException(PICKUP_DISABLED_MESSAGE));
    });
  });

  describe('entrega', () => {
    it('cobra a taxa da cidade e congela nome, estado e prazo', async () => {
      const lookup: Lookup = {};
      const service = serviceWith(storeWith(), cityWith(), lookup);

      const quote = await service.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: CITY_ID.toHexString(),
        subtotalCents: 9_000,
      });

      expect(quote.feeCents).toBe(1_500);
      expect(quote.isFree).toBe(false);
      expect(quote.cityId).toBe(CITY_ID.toHexString());
      expect(quote.cityName).toBe('Juazeiro do Norte');
      expect(quote.state).toBe('CE');
      expect(quote.estimatedDays).toBe(2);
      expect(quote.requiresAddress).toBe(true);
      // Cidade desativada nao pode ser encontrada, e a garantia e do filtro.
      expect(lookup.filter).toEqual({ _id: CITY_ID, isActive: true });
    });

    it('isenta pela regra da loja e diz quanto faltava antes disso', async () => {
      const service = serviceWith(storeWith({ freeShippingMinCents: 15_000 }), cityWith());

      const abaixo = await service.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: CITY_ID.toHexString(),
        subtotalCents: 12_000,
      });
      const alcancado = await service.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: CITY_ID.toHexString(),
        subtotalCents: 15_000,
      });

      expect(abaixo.feeCents).toBe(1_500);
      expect(abaixo.missingForFreeCents).toBe(3_000);
      expect(alcancado.isFree).toBe(true);
      expect(alcancado.feeCents).toBe(0);
    });

    it('a regra da cidade substitui a da loja, inclusive sendo mais alta', async () => {
      const service = serviceWith(
        storeWith({ freeShippingMinCents: 15_000 }),
        cityWith({ minOrderForFreeCents: 30_000 }),
      );

      const quote = await service.resolveFee({
        mode: FULFILLMENT_MODES.DELIVERY,
        cityId: CITY_ID.toHexString(),
        subtotalCents: 20_000,
      });

      // Passou do minimo da loja e mesmo assim paga: cidade distante costuma
      // ter minimo proprio justamente para nao cair na regra geral.
      expect(quote.isFree).toBe(false);
      expect(quote.missingForFreeCents).toBe(10_000);
    });

    it('exige a cidade', async () => {
      const service = serviceWith(storeWith(), cityWith());

      await expect(
        service.resolveFee({ mode: FULFILLMENT_MODES.DELIVERY, subtotalCents: 9_000 }),
      ).rejects.toThrow(new UnprocessableEntityException(CITY_REQUIRED_MESSAGE));
    });

    it('trata cidade desativada, inexistente e id malformado do mesmo jeito', async () => {
      const ausente = serviceWith(storeWith(), null);
      const malformado = serviceWith(storeWith(), cityWith());

      // Para quem esta comprando, "nao atendemos ai" e "paramos de atender
      // ai" dao no mesmo: a escolha nao vale mais.
      await expect(
        ausente.resolveFee({
          mode: FULFILLMENT_MODES.DELIVERY,
          cityId: new Types.ObjectId().toHexString(),
          subtotalCents: 9_000,
        }),
      ).rejects.toThrow(new UnprocessableEntityException(CITY_UNAVAILABLE_MESSAGE));

      await expect(
        malformado.resolveFee({
          mode: FULFILLMENT_MODES.DELIVERY,
          cityId: 'nao-e-um-id',
          subtotalCents: 9_000,
        }),
      ).rejects.toThrow(new UnprocessableEntityException(CITY_UNAVAILABLE_MESSAGE));
    });
  });
});
