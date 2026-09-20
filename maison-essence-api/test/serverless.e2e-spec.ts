import { Logger } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import handler from '../api/index.js';

describe('handler serverless (api/index.ts)', () => {
  let server: Server;
  const connectedLogs: string[] = [];

  beforeAll(() => {
    // O log do evento `connected` e a evidencia de quantos sockets foram
    // abertos; o mock tambem cala o ruido de boot do Nest nos testes.
    vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      if (typeof message === 'string' && message.startsWith('Conectado ao MongoDB')) {
        connectedLogs.push(message);
      }
    });

    // Simula a invocacao da Vercel: cada request entra pelo handler exportado.
    server = createServer((req, res) => {
      void handler(req, res);
    });
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  it('serve GET /api/v1/health pelo handler', async () => {
    const response = await request(server).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      database: { status: 'connected' },
    });
  });

  it('reaproveita a mesma instancia Nest entre invocacoes', async () => {
    const first = await request(server).get('/api/v1/health').expect(200);
    const second = await request(server).get('/api/v1/health').expect(200);

    // uptime nunca reinicia porque o app nao e recriado a cada request.
    expect(second.body.uptime).toBeGreaterThanOrEqual(first.body.uptime);
  });

  it('duas invocacoes reaproveitam o mesmo socket do Mongo', async () => {
    await request(server).get('/api/v1/health').expect(200);
    await request(server).get('/api/v1/health').expect(200);

    expect(connectedLogs).toHaveLength(1);
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
