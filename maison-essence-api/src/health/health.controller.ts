import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import type { HealthStatus } from './health.service.js';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  check(@Res({ passthrough: true }) response: Response): HealthStatus {
    const status = this.health.check();

    // `passthrough` para trocar so o status: o corpo continua saindo pelo
    // retorno, passando pelo interceptor global como qualquer outra rota.
    response.status(
      status.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return status;
  }
}
