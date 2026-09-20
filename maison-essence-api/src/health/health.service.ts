import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';

export interface HealthStatus {
  status: 'ok';
  uptime: number;
  version: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime() * 1000) / 1000,
      version: this.config.get('APP_VERSION', { infer: true }),
    };
  }
}
