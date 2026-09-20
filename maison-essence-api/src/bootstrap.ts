import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './config/env.schema.js';
import { parseCorsOrigins } from './config/env.schema.js';

export const GLOBAL_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): INestApplication {
  const config: ConfigService<Env, true> = app.get(ConfigService);
  const origins = parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true }));

  app.use(helmet());
  app.use(compression());
  // Os tokens de sessao chegam em cookie httpOnly; sem o parser, req.cookies
  // nao existe e so o caminho do Bearer funcionaria.
  app.use(cookieParser());
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  });

  return app;
}
