import { ForbiddenException } from '@nestjs/common';
import { USER_ROLES } from '../../common/enums/user-role.js';
import type { UserRole } from '../../common/enums/user-role.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import {
  assertCanEditSettings,
  frameFieldsIn,
  storeFrameMessage,
} from './settings-access.policy.js';

function actor(role: UserRole): AuthenticatedUser {
  return {
    id: 'ator',
    name: 'Fulano',
    email: 'fulano@maisonessence.com',
    role,
    isActive: true,
    mustChangePassword: false,
    credentialVersion: 1,
    lastLoginAt: null,
  };
}

function body(fields: Partial<UpdateSettingsDto>): UpdateSettingsDto {
  return fields as UpdateSettingsDto;
}

describe('policy de acesso as configuracoes', () => {
  describe('o que o gerente grava', () => {
    it('passa o cadastro da loja inteiro', () => {
      const dto = body({
        storeName: 'Maison Essence Sobral',
        whatsappNumber: '5588999999999',
        contactEmail: 'contato@maisonessence.com',
        businessHours: 'Seg a Sex, 9h as 18h',
        announcementText: 'Frete gratis acima de R$ 199',
        freeShippingMinCents: 19_900,
      });

      expect(frameFieldsIn(dto)).toEqual([]);
      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), dto);
      }).not.toThrow();
    });

    it('passa a retirada na loja, com endereco e instrucoes', () => {
      const dto = body({
        pickupEnabled: true,
        pickupAddress: { city: 'Sobral', state: 'CE' } as UpdateSettingsDto['pickupAddress'],
        pickupInstructions: 'Toque a campainha do portao azul.',
      });

      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), dto);
      }).not.toThrow();
    });

    /**
     * O brinde e regra de operacao, como o minimo de frete gratis.
     *
     * Ligar a campanha, trocar o valor meta e escolher o produto sao decisoes
     * do expediente — a mesma natureza do "frete gratis acima de R$ 199" que
     * ja esta logo acima. Apontar um produto nao faz disso moldura: o que
     * define a moldura e aparecer em toda pagina e nao mudar no dia a dia.
     */
    it('passa o brinde por valor de compra', () => {
      const dto = body({
        gift: {
          isActive: true,
          minCents: 17_999,
          label: 'um porta hidratante com a melhor pasta arabe dentro',
        } as UpdateSettingsDto['gift'],
      });

      expect(frameFieldsIn(dto)).toEqual([]);
      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), dto);
      }).not.toThrow();
    });

    /**
     * A vitrine da home passou a ser do expediente.
     *
     * O perfume da vez, a fileira de mais vendidos, a faixa de marcas e as
     * redes sociais mudam com a estacao e com o estoque — quem esta na loja
     * decide, e errar custa uma correcao de um minuto. `null` em
     * `featuredPerfumeProductId` devolve a escolha ao primeiro destaque, e
     * tambem e do gerente.
     */
    it('passa a vitrine da home e as redes sociais', () => {
      const dto = body({
        featuredPerfumeProductId: null,
        bestSellerProductIds: ['64b7f1c2a1b2c3d4e5f60718'],
        brands: [],
        socialLinks: { instagram: 'maisonessence' } as UpdateSettingsDto['socialLinks'],
      });

      expect(frameFieldsIn(dto)).toEqual([]);
      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), dto);
      }).not.toThrow();
    });

    it('nao reclama de corpo vazio: salvar sem editar nada e so um no-op', () => {
      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), body({}));
      }).not.toThrow();
    });
  });

  describe('o que e moldura da loja', () => {
    it.each([
      ['banners', body({ banners: [] })],
      ['institutionalPages', body({ institutionalPages: [] })],
      ['posters', body({ posters: [] })],
    ])('recusa o gerente em %s', (_nome, dto) => {
      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), dto);
      }).toThrow(ForbiddenException);
    });



    it('recusa o corpo inteiro, e nao so o campo: nao ha gravacao pela metade', () => {
      const dto = body({ storeName: 'Maison Essence Sobral', banners: [] });

      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), dto);
      }).toThrow(ForbiddenException);
    });

    it('o administrador grava tudo', () => {
      const dto = body({
        banners: [],
        institutionalPages: [],
        posters: [],
        storeName: 'Maison Essence Sobral',
      });

      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.SUPER_ADMIN), dto);
      }).not.toThrow();
    });
  });

  describe('a mensagem nomeia o que foi recusado', () => {
    it('um campo sai sem lista', () => {
      expect(storeFrameMessage(['banners'])).toContain('Só o administrador altera o carrossel da home.');
    });

    it('varios campos saem separados por virgula e um "e"', () => {
      expect(storeFrameMessage(['banners', 'institutionalPages', 'posters'])).toContain(
        'o carrossel da home, as páginas do rodapé e os cartazes de coleção',
      );
    });

    it('a ordem e a da lista de campos, e nao a do corpo recebido', () => {
      const dto = body({ posters: [], banners: [] });

      expect(frameFieldsIn(dto)).toEqual(['banners', 'posters']);
    });
  });
});
