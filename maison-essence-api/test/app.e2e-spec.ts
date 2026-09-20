import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

class CreateThingDto {
  @IsString()
  name: string;
}

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
    process.env.CORS_ORIGINS ??= 'http://localhost:5173';

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

    expect(response.body).toMatchObject({ status: 'ok' });
    expect(typeof response.body.uptime).toBe('number');
    expect(typeof response.body.version).toBe('string');
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
