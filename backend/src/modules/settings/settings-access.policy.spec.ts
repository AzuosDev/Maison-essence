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
      [
        'socialLinks',
        body({
          socialLinks: { instagram: 'maisonessence' } as UpdateSettingsDto['socialLinks'],
        }),
      ],
      ['featuredPerfumeProductId', body({ featuredPerfumeProductId: '64b7f1c2a1b2c3d4e5f60718' })],
    ])('recusa o gerente em %s', (_nome, dto) => {
      expect(() => {
        assertCanEditSettings(actor(USER_ROLES.OWNER), dto);
      }).toThrow(ForbiddenException);
    });

    it('trata null como edicao: apagar a escolha tambem e mexer na moldura', () => {
      const dto = body({ featuredPerfumeProductId: null });

      expect(frameFieldsIn(dto)).toEqual(['featuredPerfumeProductId']);
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
        featuredPerfumeProductId: null,
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
      expect(storeFrameMessage(['banners', 'institutionalPages', 'socialLinks'])).toContain(
        'o carrossel da home, as páginas do rodapé e as redes sociais',
      );
    });

    it('a ordem e a da lista de campos, e nao a do corpo recebido', () => {
      const dto = body({ socialLinks: {} as UpdateSettingsDto['socialLinks'], banners: [] });

      expect(frameFieldsIn(dto)).toEqual(['banners', 'socialLinks']);
    });
  });
});
