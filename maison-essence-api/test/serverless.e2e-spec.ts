import { createServer, type Server } from 'node:http';
import request from 'supertest';
import handler from '../api/index.js';

describe('handler serverless (api/index.ts)', () => {
  let server: Server;

  beforeAll(() => {
    process.env.CORS_ORIGINS ??= 'http://localhost:5173';
    // Simula a invocacao da Vercel: cada request entra pelo handler exportado.
    server = createServer((req, res) => {
      void handler(req, res);
    });
  });

  afterAll(() => {
    server.close();
  });

  it('serve GET /api/v1/health pelo handler', async () => {
    const response = await request(server).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('reaproveita a mesma instancia Nest entre invocacoes', async () => {
    const first = await request(server).get('/api/v1/health').expect(200);
    const second = await request(server).get('/api/v1/health').expect(200);

    // uptime nunca reinicia porque o app nao e recriado a cada request.
    expect(second.body.uptime).toBeGreaterThanOrEqual(first.body.uptime);
  });

  it('aplica o filtro global de excecoes', async () => {
    const response = await request(server).get('/api/v1/nada').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/api/v1/nada',
    });
  });
});
