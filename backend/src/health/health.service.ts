import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { STATES } from 'mongoose';
import type { Env } from '../config/env.schema.js';

export type DatabaseStatus =
  | 'connected'
  | 'connecting'
  | 'disconnecting'
  | 'disconnected'
  | 'uninitialized';

export interface DatabaseHealth {
  status: DatabaseStatus;
  readyState: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  uptime: number;
  version: string;
  database: DatabaseHealth;
}

const DATABASE_STATUS: Record<number, DatabaseStatus> = {
  [STATES.disconnected]: 'disconnected',
  [STATES.connected]: 'connected',
  [STATES.connecting]: 'connecting',
  [STATES.disconnecting]: 'disconnecting',
  [STATES.uninitialized]: 'uninitialized',
};

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  check(): HealthStatus {
    const database = this.describeDatabase();

    return {
      // Só `connected` e saudável: com bufferCommands desligado, qualquer
      // outro estado significa que as queries deste request iriam falhar.
      status: database.status === 'connected' ? 'ok' : 'error',
      uptime: Math.round(process.uptime() * 1000) / 1000,
      version: this.config.get('APP_VERSION', { infer: true }),
      database,
    };
  }

  private describeDatabase(): DatabaseHealth {
    const { readyState } = this.connection;

    return {
      status: DATABASE_STATUS[readyState] ?? 'uninitialized',
      readyState,
    };
  }
}
