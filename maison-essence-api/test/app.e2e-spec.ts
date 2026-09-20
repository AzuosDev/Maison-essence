import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import type { Connection } from 'mongoose';
import { STATES } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { configureApp } from '../src/bootstrap.js';

class CreateThingDto {
  @IsString()
  name: string;
}

// @Public(): desde o modulo de autenticacao toda rota nasce protegida, e o
// que este controller existe para exercitar e o ValidationPipe.
@Public()
@Controller('things')
class ThingsController {
  @Post()
  create(@Body() dto: CreateThingDto): CreateThingDto {
    return dto;
  }
}

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ThingsController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health responde 200', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      database: { status: 'connected', readyState: 1 },
    });
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.version).toBe('string');
  });

  it('responde 503 quando o Mongoose nao esta conectado', async () => {
    const connection = app.get<Connection>(getConnectionToken());
    const readyState = vi
      .spyOn(connection, 'readyState', 'get')
      .mockReturnValue(STATES.disconnected);

    try {
      const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);

      expect(response.body).toMatchObject({
        status: 'error',
        database: { status: 'disconnected', readyState: 0 },
      });
    } finally {
      readyState.mockRestore();
    }
  });

  it('rota inexistente devolve o formato padrao de erro', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nada').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/api/v1/nada',
    });
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.body).not.toHaveProperty('stack');
  });

  it('rejeita propriedades fora do DTO (forbidNonWhitelisted)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/things')
      .send({ name: 'vela', extra: 'nao permitido' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain('property extra should not exist');
  });
});
