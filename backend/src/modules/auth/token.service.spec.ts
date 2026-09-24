import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { USER_ROLES } from '../../common/enums/user-role.js';
import type { Env } from '../../config/env.schema.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { TOKEN_TYPES } from './auth.types.js';
import { TokenService } from './token.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';

const ACCESS_SECRET = 'access-secret-para-teste-0123456789';
const REFRESH_SECRET = 'refresh-secret-para-teste-0123456789';

function buildConfig(): ConfigService<Env, true> {
  const values: Partial<Env> = {
    JWT_ACCESS_SECRET: ACCESS_SECRET,
    JWT_REFRESH_SECRET: REFRESH_SECRET,
  };

  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

function buildUser(overrides: Partial<UserDocument> = {}): UserDocument {
  return {
    _id: new Types.ObjectId(),
    email: 'dona@maisonessence.com',
    role: USER_ROLES.OWNER,
    credentialVersion: 3,
    mustChangePassword: false,
    ...overrides,
  } as UserDocument;
}

describe('TokenService', () => {
  const jwt = new JwtService();
  const tokens = new TokenService(jwt, buildConfig());

  it('assina o access token com sub, email, papel e versão da credencial', async () => {
    const user = buildUser();
    const token = await tokens.signAccessToken(user);
    const payload = await tokens.verifyAccessToken(token);

    expect(payload).toMatchObject({
      sub: user._id.toHexString(),
      email: 'dona@maisonessence.com',
      role: USER_ROLES.OWNER,
      credentialVersion: 3,
      mustChangePassword: false,
      type: TOKEN_TYPES.ACCESS,
    });
  });

  it('o access token vale 15 minutos', async () => {
    const token = await tokens.signAccessToken(buildUser());
    const { iat, exp } = await tokens.verifyAccessToken(token);

    expect((exp ?? 0) - (iat ?? 0)).toBe(ACCESS_TOKEN_TTL_SECONDS);
  });

  it('carrega mustChangePassword no access token', async () => {
    const token = await tokens.signAccessToken(buildUser({ mustChangePassword: true }));

    await expect(tokens.verifyAccessToken(token)).resolves.toMatchObject({
      mustChangePassword: true,
    });
  });

  it('não aceita refresh token no lugar do access token', async () => {
    const refresh = await tokens.signRefreshToken(
      new Types.ObjectId().toHexString(),
      new Types.ObjectId().toHexString(),
    );

    await expect(tokens.verifyAccessToken(refresh)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('recusa token assinado com outro segredo', async () => {
    const forged = await jwt.signAsync(
      { sub: 'x', type: TOKEN_TYPES.ACCESS },
      { secret: 'segredo-de-outra-pessoa-0123456789' },
    );

    await expect(tokens.verifyAccessToken(forged)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('recusa token expirado', async () => {
    const expired = await jwt.signAsync(
      { sub: 'x', type: TOKEN_TYPES.ACCESS },
      { secret: ACCESS_SECRET, expiresIn: -60 },
    );

    await expect(tokens.verifyAccessToken(expired)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
