import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { basicAuth } from './basic-auth.js';
import type { BasicCredentials } from './basic-auth.js';

const logger = new Logger('Swagger');

export interface SwaggerOptions {
  /** Caminho completo, com o prefixo global: `api/v1/docs`. */
  path: string;
  version: string;
  /** Credencial que abre a documentacao. Sem ela, em producao nada e montado. */
  credentials?: BasicCredentials;
  isProduction: boolean;
}

/**
 * A documentacao da API.
 *
 * Existe para quem vai escrever o frontend e para quem pegar este projeto
 * depois: a lista de rotas, o formato de cada corpo e o significado de cada
 * status, geradas do proprio codigo em vez de escritas a mao num documento que
 * envelhece na primeira semana.
 *
 * Em producao ela fica atras de senha. Nao porque a lista de rotas seja
 * segredo — quem quiser descobre chamando —, mas porque uma documentacao
 * aberta e um mapa pronto: ela diz de uma vez quais rotas existem, quais
 * campos cada uma aceita e onde estao as administrativas. Sem credencial
 * configurada, a documentacao simplesmente nao sobe em producao: e o lado
 * seguro do esquecimento.
 */
export function setupSwagger(app: INestApplication, options: SwaggerOptions): void {
  if (options.isProduction && !options.credentials) {
    logger.warn(
      'Documentação desligada: defina DOCS_USER e DOCS_PASSWORD para publica-lá em produção',
    );

    return;
  }

  if (options.credentials) {
    // Antes do `setup`: o Express roda os middlewares na ordem em que foram
    // registrados, e um registrado depois da rota nao e consultado por ela.
    app.use(`/${options.path}`, basicAuth(options.credentials, 'Maison Essence API'));
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Maison Essence API')
      .setDescription(
        [
          'API da loja e do painel administrativo.',
          '',
          'As rotas do painel exigem um access token de administrador; as da',
          'conta de cliente exigem um token de cliente, que e emitido com outro',
          'segredo e nunca serve para o painel. O resto e público.',
        ].join('\n'),
      )
      .setVersion(options.version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'customer')
      .build(),
  );

  SwaggerModule.setup(options.path, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
